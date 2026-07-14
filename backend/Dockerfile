FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /build

COPY pom.xml ./
RUN mvn -q -DskipTests dependency:go-offline

COPY config ./config
COPY src ./src
RUN mvn -q -DskipTests -Dcheckstyle.skip=true -Dspotbugs.skip=true package

# FIX C6: Instead of hardcoding `shop-backend-1.0.0-exec.jar` (breaks on every
# version bump), rename the artifact to a fixed name in the package step so the
# COPY instruction never needs updating.
RUN mv target/shop-backend-*-exec.jar target/app.jar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache wget \
    && addgroup -S spring && adduser -S -G spring spring

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:InitialRAMPercentage=25 -Djava.security.egd=file:/dev/urandom"

COPY --from=build /build/target/app.jar /app/app.jar

USER spring
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
