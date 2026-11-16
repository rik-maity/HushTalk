
package com.hushtalk.repository;

import com.hushtalk.entity.PasswordResetToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PasswordResetTokenRepository
        extends JpaRepository<PasswordResetToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT prt
            FROM PasswordResetToken prt
            WHERE prt.tokenHash = :tokenHash
            """)
    Optional<PasswordResetToken> findByTokenHashForUpdate(
            @Param("tokenHash") String tokenHash
    );

    @Modifying
    @Query("""
            DELETE FROM PasswordResetToken prt
            WHERE prt.user.id = :userId
            AND prt.usedAt IS NULL
            """)
    void deleteUnusedTokensByUserId(
            @Param("userId") Long userId
    );
}
