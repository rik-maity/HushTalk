
package com.hushtalk.service;

import com.hushtalk.dto.UserRequest;
import com.hushtalk.dto.UserResponse;
import com.hushtalk.entity.User;
import com.hushtalk.exception.UserAlreadyExistsException;
import com.hushtalk.exception.UserNotFoundException;
import com.hushtalk.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserResponse createUser(UserRequest request) {

        String email = request.getEmail()
                .trim()
                .toLowerCase(Locale.ROOT);

        String username = request.getUsername().trim();

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserAlreadyExistsException(
                    "User with email already exists: " + email
            );
        }

        if (userRepository.existsByUsername(username)) {
            throw new UserAlreadyExistsException(
                    "Username already exists: " + username
            );
        }

        User user = new User();

        user.setUsername(username);
        user.setEmail(email);

        user.setPassword(
                passwordEncoder.encode(request.getPassword())
        );

        // No email verification required.

        User savedUser = userRepository.save(user);

        return new UserResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail()
        );
    }

    public List<UserResponse> getAllUsers() {

        return userRepository.findAll()
                .stream()
                .map(user -> new UserResponse(
                        user.getId(),
                        user.getUsername(),
                        user.getEmail()
                ))
                .toList();
    }

    public UserResponse getUserById(Long id) {

        User user = userRepository.findById(id)
                .orElseThrow(() ->
                        new UserNotFoundException(
                                "User not found with id: " + id
                        )
                );

        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail()
        );
    }
}
