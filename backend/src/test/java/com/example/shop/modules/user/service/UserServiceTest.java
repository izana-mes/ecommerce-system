package com.example.shop.modules.user.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.token.service.TokenService;
import com.example.shop.modules.user.dto.request.ChangePasswordRequest;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private TokenService tokenService;

    @InjectMocks private UserService userService;

    @Test
    void changePassword_rejectsWrongCurrentPassword() {
        User user = User.builder().email("qa@example.com").password("encoded-old").build();
        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword("wrong");
        req.setNewPassword("new-pass");
        req.setConfirmPassword("new-pass");

        when(userRepository.findByEmail("qa@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded-old")).thenReturn(false);

        assertThrows(BusinessException.class, () -> userService.changePassword("qa@example.com", req));
        verify(userRepository, never()).save(any());
    }
}
