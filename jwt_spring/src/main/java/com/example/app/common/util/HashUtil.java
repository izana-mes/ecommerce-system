package com.example.app.common.util;

import com.example.app.common.exception.BusinessException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Utility class for hashing operations.
 * Used to hash tokens or other sensitive data before storing in database.
 */
public class HashUtil {

    private static final String ALGORITHM = "SHA-256";

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
        return hash(input).equals(hash);
    }
}
