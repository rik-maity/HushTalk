
package com.hushtalk.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MockEmailService {

    private static final Logger logger =
            LoggerFactory.getLogger(MockEmailService.class);

    public void sendPasswordResetEmail(
            String email,
            String resetToken
    ) {

        logger.info("========== MOCK PASSWORD RESET EMAIL ==========");
        logger.info("Recipient: {}", email);
        logger.info("Reset token: {}", resetToken);
        logger.info("Token expires in 15 minutes.");
        logger.info("================================================");
    }

    public void sendVerificationEmail(
            String email,
            String verificationToken
    ) {

        logger.info("========== MOCK EMAIL VERIFICATION ==========");
        logger.info("Recipient: {}", email);
        logger.info("Verification token: {}", verificationToken);
        logger.info("Token expires in 15 minutes.");
        logger.info("==============================================");
    }
}
