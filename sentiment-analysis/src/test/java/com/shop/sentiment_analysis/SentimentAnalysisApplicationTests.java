package com.shop.sentiment_analysis;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:context-test;MODE=PostgreSQL") // jamais la vraie base
class SentimentAnalysisApplicationTests {

	@Test
	void contextLoads() {
	}

}
