
package com.hushtalk.repository;

import com.hushtalk.entity.ConversationMembership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationMembershipRepository
        extends JpaRepository<ConversationMembership, Long> {

    boolean existsByConversationIdAndUserId(
            Long conversationId,
            Long userId
    );

    List<ConversationMembership> findByConversationId(
            Long conversationId
    );

    List<ConversationMembership> findByUserId(
            Long userId
    );

    Optional<ConversationMembership> findByConversationIdAndUserId(
            Long conversationId,
            Long userId
    );
}
