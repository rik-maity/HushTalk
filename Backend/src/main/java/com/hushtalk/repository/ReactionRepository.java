
package com.hushtalk.repository;

import com.hushtalk.entity.Reaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReactionRepository
        extends JpaRepository<Reaction, Long> {

    boolean existsByMessageIdAndUserIdAndType(
            Long messageId,
            Long userId,
            String type
    );

    Optional<Reaction> findByMessageIdAndUserIdAndType(
            Long messageId,
            Long userId,
            String type
    );

    List<Reaction> findByMessageIdOrderByCreatedAtAsc(
            Long messageId
    );

    long deleteByMessageIdAndUserIdAndType(
            Long messageId,
            Long userId,
            String type
    );
}
