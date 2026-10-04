package com.shop.sentiment_analysis.storage;

import com.shop.sentiment_analysis.auth.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Stockage des images sur disque (dossier app.uploads.dir), servies publiquement sous /uploads/{dossier}/{nom}.
 * Les noms sont des UUID aléatoires (impossibles à deviner) et le type est vérifié sur le contenu réel du fichier,
 * pas seulement sur l'extension ou l'en-tête envoyé par le navigateur.
 */
@Slf4j
@Service
public class FileStorageService {

    public enum Folder { PRODUCTS, REVIEWS, AVATARS;
        String dir() { return name().toLowerCase(); }
    }

    private static final Pattern SAFE_NAME = Pattern.compile("^[a-f0-9-]{36}\\.(jpg|png|webp|gif)$");

    private final Path root;
    private final long maxBytes;

    public FileStorageService(@Value("${app.uploads.dir:uploads}") String dir,
                              @Value("${app.uploads.max-image-size:3MB}") DataSize maxSize) throws IOException {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.maxBytes = maxSize.toBytes();
        for (Folder f : Folder.values()) Files.createDirectories(root.resolve(f.dir()));
    }

    public Path root() { return root; }

    /** Enregistre une image validée et renvoie son nom de fichier. */
    public String saveImage(MultipartFile file, Folder folder) {
        if (file == null || file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "Image vide.");
        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Image trop volumineuse (" + (maxBytes / 1024 / 1024) + " Mo max).");
        }
        String ext;
        try (InputStream in = file.getInputStream()) {
            ext = detect(in.readNBytes(12));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image illisible.");
        }
        if (ext == null) throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Format d'image non pris en charge (JPG, PNG, WEBP ou GIF).");
        String name = UUID.randomUUID() + "." + ext;
        try {
            file.transferTo(root.resolve(folder.dir()).resolve(name));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossible d'enregistrer l'image.");
        }
        return name;
    }

    /** Supprime un fichier (sans erreur s'il n'existe plus). */
    public void delete(Folder folder, String name) {
        if (name == null || !SAFE_NAME.matcher(name).matches()) return; // jamais de chemin arbitraire
        try {
            Files.deleteIfExists(root.resolve(folder.dir()).resolve(name));
        } catch (IOException e) {
            log.warn("Fichier non supprimé : {}/{}", folder.dir(), name);
        }
    }

    public static String url(Folder folder, String name) {
        return name == null ? null : "/uploads/" + folder.dir() + "/" + name;
    }

    public static boolean isValidName(String name) {
        return name != null && SAFE_NAME.matcher(name).matches();
    }

    /** Signature binaire des formats acceptés. */
    static String detect(byte[] h) {
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) return "jpg";
        if (h.length >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return "png";
        if (h.length >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8') return "gif";
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }
}
