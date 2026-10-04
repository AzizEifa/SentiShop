package com.shop.sentiment_analysis.storage;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Liste de noms de fichiers stockée dans une seule colonne ("a.jpg|b.png"). */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    @Override
    public String convertToDatabaseColumn(List<String> list) {
        return list == null || list.isEmpty() ? null : String.join("|", list);
    }

    @Override
    public List<String> convertToEntityAttribute(String value) {
        return value == null || value.isBlank() ? new ArrayList<>() : new ArrayList<>(Arrays.asList(value.split("\\|")));
    }
}
