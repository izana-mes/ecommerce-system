package com.example.shop.config;

import com.example.shop.modules.role.entity.Role;
import com.example.shop.modules.role.repository.RoleRepository;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAccountInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${application.bootstrap.admin.enabled:true}")
    private boolean enabled;

    @Value("${application.bootstrap.admin.email:admin@example.com}")
    private String adminEmail;

    @Value("${application.bootstrap.admin.password:admin123}")
    private String adminPassword;

    @Value("${application.bootstrap.admin.first-name:Admin}")
    private String adminFirstName;

    @Value("${application.bootstrap.admin.last-name:User}")
    private String adminLastName;

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) {
            return;
        }

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_USER").build()));
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_ADMIN").build()));
        roleRepository.findByName("ROLE_EMPLOYEE")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_EMPLOYEE").build()));
        roleRepository.findByName("ROLE_SUPPLIER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_SUPPLIER").build()));
        roleRepository.findByName("ROLE_SHIPPER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_SHIPPER").build()));

        User adminUser = userRepository.findByEmail(adminEmail).orElse(null);

        if (adminUser == null) {
            User newAdmin = User.builder()
                    .email(adminEmail)
                    .password(passwordEncoder.encode(adminPassword))
                    .firstName(adminFirstName)
                    .lastName(adminLastName)
                    .isActive(true)
                    .isEmailVerified(true)
                    .roles(List.of(userRole, adminRole))
                    .build();
            userRepository.save(newAdmin);
            log.info("Bootstrap admin account created for {}", adminEmail);
            return;
        }

        List<Role> roles = new ArrayList<>(adminUser.getRoles() == null ? List.of() : adminUser.getRoles());
        boolean hasUserRole = roles.stream().anyMatch(role -> "ROLE_USER".equals(role.getName()));
        boolean hasAdminRole = roles.stream().anyMatch(role -> "ROLE_ADMIN".equals(role.getName()));

        if (!hasUserRole) {
            roles.add(userRole);
        }
        if (!hasAdminRole) {
            roles.add(adminRole);
        }

        adminUser.setRoles(roles);
        adminUser.setActive(true);
        adminUser.setEmailVerified(true);
        userRepository.save(adminUser);

        log.info("Bootstrap admin account ensured for {}", adminEmail);
    }
}
