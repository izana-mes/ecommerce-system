package com.example.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;

import com.example.shop.config.DatabaseUrlSupport;

@SpringBootApplication
@EnableCaching
public class ShopApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(ShopApplication.class);
        app.addListeners((ApplicationListener<ApplicationEnvironmentPreparedEvent>) ShopApplication::validateRenderDatabaseConfig);
        app.run(args);
    }

    private static void validateRenderDatabaseConfig(ApplicationEnvironmentPreparedEvent event) {
        Environment env = event.getEnvironment();
        if (!"true".equalsIgnoreCase(env.getProperty("RENDER"))) {
            return;
        }
        if (DatabaseUrlSupport.isPresent(env)) {
            return;
        }
        throw new IllegalStateException(
                "RENDER=true but no Postgres URL env var. Set DATABASE_URL to your Postgres "
                        + "Internal Database URL (Dashboard → database → Connect), or define POSTGRES_URL / "
                        + "RENDER_DATABASE_URL. If you use render.yaml, link the database with "
                        + "fromDatabase / property: connectionString.");
    }
}
