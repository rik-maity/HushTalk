
package com.hushtalk.repository;

import com.hushtalk.entity.EmailVerificationToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmailVerificationTokenRepository
        extends JpaRepository<EmailVerificationToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT evt
            FROM EmailVerificationToken evt
            WHERE evt.tokenHash = :tokenHash
            """)
    Optional<EmailVerificationToken> findByTokenHashForUpdate(
            @Param("tokenHash") String tokenHash
    );

    @Modifying
    @Query("""
            DELETE FROM EmailVerificationToken evt
            WHERE evt.user.id = :userId
            AND evt.usedAt IS NULL
            """)
    void deleteUnusedTokensByUserId(
            @Param("userId") Long userId
    );
}
