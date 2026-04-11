package com.example.shop.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

final class DatabaseUrlParser {

    record Parsed(String jdbcUrl, String username, String password) {}

    private DatabaseUrlParser() {}

    static Parsed parsePostgres(String databaseUrl) {
        if (databaseUrl == null || databaseUrl.isBlank()) {
            throw new IllegalArgumentException("DATABASE_URL is empty");
        }
        String url = databaseUrl.trim();
        if (url.startsWith("postgres://")) {
            url = "postgresql://" + url.substring("postgres://".length());
        }
        if (!url.startsWith("postgresql://")) {
            throw new IllegalArgumentException("DATABASE_URL must start with postgresql:// or postgres://");
        }

        URI uri = URI.create(url);
        String host = uri.getHost();
        if (host == null || host.isEmpty()) {
            throw new IllegalArgumentException("DATABASE_URL is missing host");
        }
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String path = uri.getPath();
        if (path == null || path.length() <= 1) {
            throw new IllegalArgumentException("DATABASE_URL is missing database name in path");
        }
        String database = path.substring(1);

        String userInfo = uri.getRawUserInfo();
        if (userInfo == null || userInfo.isEmpty()) {
            throw new IllegalArgumentException("DATABASE_URL is missing user credentials");
        }
        int colon = userInfo.indexOf(':');
        String username = colon < 0
                ? URLDecoder.decode(userInfo, StandardCharsets.UTF_8)
                : URLDecoder.decode(userInfo.substring(0, colon), StandardCharsets.UTF_8);
        String password = colon < 0
                ? ""
                : URLDecoder.decode(userInfo.substring(colon + 1), StandardCharsets.UTF_8);

        String query = uri.getRawQuery();
        StringBuilder jdbcUrl = new StringBuilder();
        jdbcUrl.append("jdbc:postgresql://").append(host).append(':').append(port).append('/').append(database);
        if (query != null && !query.isEmpty()) {
            jdbcUrl.append('?').append(query);
        }

        return new Parsed(jdbcUrl.toString(), username, password);
    }
}
