
package com.hushtalk.service;

import com.hushtalk.entity.PasswordResetToken;
import com.hushtalk.entity.User;
import com.hushtalk.repository.PasswordResetTokenRepository;
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
public class PasswordResetService {

    private final PasswordResetTokenRepository tokenRepository;
    private final long expirationMs;

    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepository,
            @Value("${password-reset.expiration-ms}") long expirationMs
    ) {
        this.tokenRepository = tokenRepository;
        this.expirationMs = expirationMs;
    }

    @Transactional
    public String createResetToken(User user) {

        tokenRepository.deleteUnusedTokensByUserId(user.getId());

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        String rawToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        Instant now = Instant.now();

        PasswordResetToken resetToken = new PasswordResetToken();

        resetToken.setUser(user);
        resetToken.setTokenHash(hashToken(rawToken));
        resetToken.setCreatedAt(now);
        resetToken.setExpiresAt(now.plusMillis(expirationMs));

        tokenRepository.save(resetToken);

        return rawToken;
    }

    @Transactional
    public User consumeResetToken(String rawToken) {

        String tokenHash = hashToken(rawToken);

        PasswordResetToken resetToken =
                tokenRepository.findByTokenHashForUpdate(tokenHash)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Invalid or expired reset token"
                                )
                        );

        Instant now = Instant.now();

        if (resetToken.getUsedAt() != null ||
                !resetToken.getExpiresAt().isAfter(now)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid or expired reset token"
            );
        }

        resetToken.setUsedAt(now);

        tokenRepository.save(resetToken);

        return resetToken.getUser();
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
