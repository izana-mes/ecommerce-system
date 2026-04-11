package com.example.shop.modules.otp.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.otp.entity.OtpVerification;
import com.example.shop.modules.otp.repository.OtpVerificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class OtpService {

    private static final int OTP_TTL_MINUTES = 5;

    private final OtpVerificationRepository otpVerificationRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public String generateAndStoreOtp(String email) {
        String otp = String.format("%06d", secureRandom.nextInt(1_000_000));

        OtpVerification verification = OtpVerification.builder()
                .email(email)
                .otpCode(otp)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES))
                .isUsed(false)
                .build();

        otpVerificationRepository.save(verification);
        return otp;
    }

    /**
     * Validates OTP and marks it as used if valid.
     */
    @Transactional
    public void validateAndConsumeOtp(String email, String otp) {
        OtpVerification record = otpVerificationRepository
                .findTopByEmailAndIsUsedFalseOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new BusinessException("Invalid OTP", HttpStatus.BAD_REQUEST));

        if (record.isUsed()) {
            throw new BusinessException("OTP already used", HttpStatus.BAD_REQUEST);
        }

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("OTP expired", HttpStatus.BAD_REQUEST);
        }

        if (!record.getOtpCode().equals(otp)) {
            throw new BusinessException("Invalid OTP", HttpStatus.BAD_REQUEST);
        }

        record.setUsed(true);
        otpVerificationRepository.save(record);
    }
}
