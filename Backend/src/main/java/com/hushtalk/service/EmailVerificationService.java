
package com.hushtalk.service;

import com.hushtalk.entity.EmailVerificationToken;
import com.hushtalk.entity.User;
import com.hushtalk.repository.EmailVerificationTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Service
public class EmailVerificationService {

    private final EmailVerificationTokenRepository tokenRepository;
    private final long expirationMs;

    private final SecureRandom secureRandom = new SecureRandom();

    public EmailVerificationService(
            EmailVerificationTokenRepository tokenRepository,
            @Value("${email-verification.expiration-ms}")
            long expirationMs
    ) {
        this.tokenRepository = tokenRepository;
        this.expirationMs = expirationMs;
    }

    @Transactional
    public String createVerificationToken(User user) {

        tokenRepository.deleteUnusedTokensByUserId(user.getId());

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        String rawToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        Instant now = Instant.now();

        EmailVerificationToken token =
                new EmailVerificationToken();

        token.setUser(user);
        token.setTokenHash(hashToken(rawToken));
        token.setCreatedAt(now);
        token.setExpiresAt(now.plusMillis(expirationMs));

        tokenRepository.save(token);

        return rawToken;
    }

    @Transactional
    public User verifyToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        EmailVerificationToken token =
                tokenRepository.findByTokenHashForUpdate(tokenHash)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Invalid or expired verification token"
                                )
                        );

        Instant now = Instant.now();

        if (token.getUsedAt() != null ||
                !token.getExpiresAt().isAfter(now)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid or expired verification token"
            );
        }

        User user = token.getUser();

        if (user.isEmailVerified()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Email is already verified"
            );
        }

        token.setUsedAt(now);
        user.setEmailVerified(true);

        return user;
    }

    public String hashToken(String token) {

        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(StandardCharsets.UTF_8)
            );

            return Base64.getEncoder().encodeToString(hash);

        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "SHA-256 algorithm is not available",
                    exception
            );
        }
    }
}
