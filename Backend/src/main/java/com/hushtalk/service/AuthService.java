
package com.hushtalk.service;

import com.hushtalk.dto.AuthResponse;
import com.hushtalk.dto.ForgotPasswordRequest;
import com.hushtalk.dto.LoginRequest;
import com.hushtalk.dto.RefreshTokenRequest;
import com.hushtalk.dto.ResetPasswordRequest;
import com.hushtalk.entity.RefreshToken;
import com.hushtalk.entity.User;
import com.hushtalk.repository.RefreshTokenRepository;
import com.hushtalk.repository.UserRepository;
import com.hushtalk.security.JwtService;
import com.hushtalk.security.RefreshTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetService passwordResetService;
    private final MockEmailService mockEmailService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            RefreshTokenRepository refreshTokenRepository,
            PasswordResetService passwordResetService,
            MockEmailService mockEmailService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordResetService = passwordResetService;
        this.mockEmailService = mockEmailService;
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {

        String email = request.getEmail()
                .trim()
                .toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Invalid email or password"
                        )
                );

        if (!passwordEncoder.matches(
                request.getPassword(),
                user.getPassword()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid email or password"
            );
        }

        String accessToken = jwtService.generateToken(
                user.getId(),
                user.getEmail()
        );

        UUID familyId = UUID.randomUUID();

        String refreshToken = refreshTokenService.createRefreshToken(
                user,
                familyId
        );

        return buildAuthResponse(accessToken, refreshToken);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AuthResponse refresh(RefreshTokenRequest request) {

        String tokenHash = refreshTokenService.hashToken(
                request.getRefreshToken()
        );

        RefreshToken currentToken =
                refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "Invalid refresh token"
                                )
                        );

        if (currentToken.getRevokedAt() != null) {

            revokeTokenFamily(currentToken.getFamilyId());

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Refresh token reuse detected. Please log in again."
            );
        }

        if (!currentToken.getExpiresAt().isAfter(Instant.now())) {

            currentToken.setRevokedAt(Instant.now());

            refreshTokenRepository.save(currentToken);

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Refresh token has expired"
            );
        }

        User user = currentToken.getUser();

        currentToken.setRevokedAt(Instant.now());
        refreshTokenRepository.save(currentToken);

        String newAccessToken = jwtService.generateToken(
                user.getId(),
                user.getEmail()
        );

        String newRefreshToken =
                refreshTokenService.createRefreshToken(
                        user,
                        currentToken.getFamilyId()
                );

        return buildAuthResponse(
                newAccessToken,
                newRefreshToken
        );
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void logout(RefreshTokenRequest request) {

        String tokenHash = refreshTokenService.hashToken(
                request.getRefreshToken()
        );

        RefreshToken currentToken =
                refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED,
                                        "Invalid refresh token"
                                )
                        );

        if (currentToken.getRevokedAt() != null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Refresh token is already revoked"
            );
        }

        revokeTokenFamily(currentToken.getFamilyId());
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {

        userRepository.findByEmailIgnoreCase(request.getEmail())
                .ifPresent(user -> {

                    String resetToken =
                            passwordResetService.createResetToken(user);

                    mockEmailService.sendPasswordResetEmail(
                            user.getEmail(),
                            resetToken
                    );
                });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {

        User user = passwordResetService.consumeResetToken(
                request.getToken()
        );

        user.setPassword(
                passwordEncoder.encode(request.getNewPassword())
        );

        userRepository.save(user);

        refreshTokenRepository.revokeAllActiveTokensByUserId(
                user.getId(),
                Instant.now()
        );
    }

    private void revokeTokenFamily(UUID familyId) {

        Instant now = Instant.now();

        var tokens = refreshTokenRepository.findAllByFamilyId(familyId);

        tokens.stream()
                .filter(token -> token.getRevokedAt() == null)
                .forEach(token -> token.setRevokedAt(now));

        refreshTokenRepository.saveAll(tokens);
    }

    private AuthResponse buildAuthResponse(
            String accessToken,
            String refreshToken
    ) {
        return new AuthResponse(
                accessToken,
                refreshToken,
                "Bearer",
                jwtService.getExpirationMs() / 1000,
                refreshTokenService.getRefreshExpirationMs() / 1000
        );
    }
}
