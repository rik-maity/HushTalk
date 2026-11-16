
package com.hushtalk.repository;

import com.hushtalk.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsername(String username);

    Optional<User> findByEmailIgnoreCase(String email);
}
