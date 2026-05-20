package com.example.shop.common.util;

import com.example.shop.common.exception.BusinessException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Utility class for hashing operations.
 * Used to hash tokens or other sensitive data before storing in database.
 */
public class HashUtil {

    private static final String ALGORITHM = "SHA-256";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * Hashes a string using SHA-256.
     * 
     * @param input The string to hash
     * @return The hashed string in Base64 format
     */
    public static String hash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance(ALGORITHM);
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException("Error hashing data", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Verifies if an input matches a hash.
     * 
     * @param input The raw input string
     * @param hash  The hash to compare against
     * @return true if matches, false otherwise
     */
    public static boolean verify(String input, String hash) {
        return constantTimeEquals(hash(input), hash);
    }

    public static boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }

    public static String generateSecureToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
