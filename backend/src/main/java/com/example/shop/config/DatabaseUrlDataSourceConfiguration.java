package com.example.shop.config;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import com.zaxxer.hikari.HikariDataSource;

/**
 * Binds Flyway/JPA to Render-style {@code DATABASE_URL} when present. Supersedes
 * {@code spring.datasource.*} from YAML so the app does not fall back to localhost.
 */
@Configuration
@Conditional(DatabaseUrlPresentCondition.class)
public class DatabaseUrlDataSourceConfiguration {

    @Bean
    @Primary
    public DataSource dataSource(Environment environment) {
        String databaseUrl = DatabaseUrlSupport.getRequired(environment);
        DatabaseUrlParser.Parsed parsed = DatabaseUrlParser.parsePostgres(databaseUrl);
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(parsed.jdbcUrl());
        ds.setUsername(parsed.username());
        ds.setPassword(parsed.password());
        ds.setDriverClassName("org.postgresql.Driver");
        return ds;
    }
}
