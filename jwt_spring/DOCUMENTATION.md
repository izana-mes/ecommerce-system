# JWT Authentication & Authorization – Learning Guide

This document explains each class, annotation, and flow in the project so you can **learn** rather than just copy.

---

## 1. Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Controller    │────▶│    Service      │────▶│   Repository    │
│ (HTTP layer)    │     │ (Business logic)│     │ (Data access)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │
         │                        │ uses
         ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│   DTO (req/resp)│     │  Entity, Util,  │
│                 │     │  EmailService   │
└─────────────────┘     └─────────────────┘
```

- **Controller**: HTTP only. Validates input, delegates to service, returns response.
- **Service**: Business logic only. No SQL, no `EntityManager`.
- **Repository**: Data access only. Spring Data JPA method naming.

---

## 2. Class-by-Class Explanation

### Application.java

**What it does**: Entry point. Bootstraps Spring Boot.

**Why it exists**: Spring Boot needs a main class with `@SpringBootApplication`.

**Annotations**:
- `@SpringBootApplication`: Combines `@Configuration`, `@EnableAutoConfiguration`, `@ComponentScan`.

---

### Config Layer

#### SecurityConfig.java

**What it does**:
- Configures which URLs are public (`/api/v1/auth/**`) vs protected.
- Uses stateless JWT: no HTTP session.
- Adds `JwtAuthenticationFilter` before `UsernamePasswordAuthenticationFilter`.
- Configures `PasswordEncoder`, `AuthenticationProvider`, `AuthenticationManager`.

**Why it exists**: Spring Security must be told how to use JWT instead of form login.

**Important**:
- `sessionCreationPolicy(STATELESS)`: No session; every request must carry JWT.
- `addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)`: JWT is checked before login.

#### JwtConfig.java

**What it does**: Placeholder for JWT-related configuration (e.g. `@ConfigurationProperties`).

**Why it exists**: Keeps JWT config separate from security filter chain config.

#### MailConfig.java

**What it does**: Adds `@EnableAsync` for async email sending.

**Why it exists**: `EmailService` uses `@Async` so email sending does not block the HTTP thread.

#### JpaConfig.java

**What it does**: Enables JPA auditing (`@CreatedDate`, `@LastModifiedDate`).

**Why it exists**: Entities get `createdAt` and `updatedAt` automatically.

---

### Common Layer

#### BusinessException.java

**What it does**: Custom exception with HTTP status for business rule violations.

**Why it exists**: Single exception type for consistent API error handling.

#### UnauthorizedException.java

**What it does**: Exception for auth failures (401).

**Why it exists**: Clear semantic for “not authenticated”.

#### GlobalExceptionHandler.java

**What it does**: `@RestControllerAdvice` that maps exceptions to `ApiResponse`.

**Why it exists**: Central place to convert exceptions into a unified JSON format.

#### ApiResponse.java

**What it does**: Wrapper for all API responses: `success`, `message`, `data`, `timestamp`.

**Why it exists**: Consistent response shape across endpoints.

#### HashUtil.java

**What it does**: SHA-256 hashing for tokens before storing in DB.

**Why it exists**: Tokens in emails should not be stored in plain text. Hash for lookup, raw token only in email.

#### JwtUtil.java

**What it does**: Low-level JWT encode/decode utility (kept for reference; `JwtProvider` is the main security component).

**Why it exists**: Optional shared utility; auth module uses `JwtProvider`.

#### EmailService (interface) / SmtpEmailService / EmailTemplateService

**What it does**:
- `EmailService`: Contract for sending emails.
- `SmtpEmailService`: Implementation via `JavaMailSender`, uses templates.
- `EmailTemplateService`: Builds HTML for verification and password reset emails.

**Why it exists**: Decouples business logic from SMTP. Allows swapping implementations (e.g. SendGrid).

---

### Auth Module

#### AuthController.java

**What it does**: Handles HTTP for register, login, refresh, verify-email, resend-verification, forgot-password, reset-password.

**Why it exists**: Single controller for all auth-related endpoints.

**Rule**: No business logic. Only validation, delegation to service, and response building.

#### AuthService / AuthServiceImpl.java

**What it does**:
- `register`: Create user, assign role, send verification email, return tokens.
- `authenticate`: Validate credentials, check email verified, return tokens.
- `refreshToken`: Validate refresh token, issue new access token.
- `verifyEmail`: Validate token, mark user as verified.
- `resendVerificationEmail`: Resend verification for unverified user.
- `requestPasswordReset`: Create reset token, send email.
- `resetPassword`: Validate token, update password, revoke refresh tokens.

**Why it exists**: Holds all authentication business logic.

**@Transactional**: Used where the method modifies multiple entities in one transaction.

#### JwtProvider.java

**What it does**: Generates and validates access tokens using jjwt.

**Why it exists**: Central JWT handling for the auth module.

**How it interacts**: Used by `AuthService` (token generation) and `JwtAuthenticationFilter` (validation).

#### JwtAuthenticationFilter.java

**What it does**:
- Reads `Authorization: Bearer <token>`.
- If present, extracts username, loads `UserDetails`, validates token.
- If valid, sets `SecurityContextHolder` with `UsernamePasswordAuthenticationToken`.

**Why it exists**: Converts JWT into Spring Security authentication.

**Extends `OncePerRequestFilter`**: Ensures it runs once per request.

#### UserDetailsServiceImpl.java

**What it does**: Implements `UserDetailsService.loadUserByUsername(String username)` by loading user from DB by email.

**Why it exists**: Spring Security needs this to resolve users during authentication.

---

### User Module

#### User (entity)

**What it does**: Represents a user: email, password, roles, `emailVerified`, etc.

**Implements `UserDetails`**: Required by Spring Security for authentication.

**Relationships**: `@ManyToMany` with `Role`.

#### UserRepository

**What it does**: `findByEmail(String email)` for login and lookup.

**Method naming**: `findByEmail` → Spring Data generates `WHERE email = ?`.

#### UserService

**What it does**: `findById`, `findByEmail` for user lookup.

**Why it exists**: Placeholder for future user-related business logic (profile, settings, etc.).

---

### Role Module

#### Role (entity)

**What it does**: Represents a role (e.g. `ROLE_USER`, `ROLE_ADMIN`).

**Relationship**: `@ManyToMany(mappedBy = "roles")` with `User`.

#### RoleRepository

**What it does**: `findByName(String name)` for role lookup during registration.

---

### Token Module

#### RefreshToken, EmailVerificationToken, PasswordResetToken (entities)

**What they do**:
- **RefreshToken**: Long-lived opaque token (e.g. 7 days) for getting new access tokens.
- **EmailVerificationToken**: One-time token for email verification; stored as hash.
- **PasswordResetToken**: Short-lived token (e.g. 1 hour) for password reset; stored as hash.

**Why stored as hash**: Raw tokens are sent by email; only hashes are stored in DB.

#### TokenService

**What it does**:
- `createRefreshToken`, `verifyRefreshToken`, `revokeRefreshToken`
- `createEmailVerificationToken`, `verifyEmailToken`, `markEmailTokenAsUsed`
- `createPasswordResetToken`, `verifyPasswordResetToken`, `markPasswordResetTokenAsUsed`

**Why it exists**: Central place for token lifecycle. Keeps `AuthService` free of token storage details.

---

## 3. Flow Explanations

### Register + Email Verification

```
1. POST /api/v1/auth/register
   └─ AuthController receives RegisterRequest
   └─ Validates (@Valid)
   └─ Calls AuthService.register()

2. AuthServiceImpl.register()
   └─ Check email not already used (UserRepository.findByEmail)
   └─ Get or create ROLE_USER (RoleRepository)
   └─ Build User with encoded password, isEmailVerified=false
   └─ Save user (UserRepository.save)
   └─ Create email verification token (TokenService.createEmailVerificationToken)
   └─ Send verification email (EmailService.sendVerificationEmail)
   └─ Generate access token (JwtProvider.generateAccessToken)
   └─ Create refresh token (TokenService.createRefreshToken)
   └─ Return AuthenticationResponse

3. User receives email with link: /api/v1/auth/verify-email?token=...
   └─ GET /api/v1/auth/verify-email?token=xxx
   └─ AuthController calls AuthService.verifyEmail(token)
   └─ TokenService.verifyEmailToken: hash token, find in DB, check not used/expired
   └─ User.setEmailVerified(true), save
   └─ Mark token as used
```

### Login

```
1. POST /api/v1/auth/authenticate
   └─ AuthController receives LoginRequest
   └─ Calls AuthService.authenticate()

2. AuthServiceImpl.authenticate()
   └─ AuthenticationManager.authenticate(email, password)
   └─ Load user (UserRepository.findByEmail)
   └─ If !user.isEmailVerified() → throw UnauthorizedException
   └─ Generate access token (JwtProvider)
   └─ Create refresh token (TokenService)
   └─ Return AuthenticationResponse
```

### Refresh Token

```
1. POST /api/v1/auth/refresh
   └─ Body: { "refreshToken": "xxx" }
   └─ AuthController calls AuthService.refreshToken(refreshToken)

2. AuthServiceImpl.refreshToken()
   └─ TokenService.verifyRefreshToken(token)
   └─ Find by token, check not revoked, not expired
   └─ Update lastUsedAt
   └─ Generate new access token for user
   └─ Return AuthenticationResponse (same refresh token, new access token)
```

### Password Reset

```
1. POST /api/v1/auth/forgot-password
   └─ Body: { "email": "user@example.com" }
   └─ AuthService.requestPasswordReset(email)
   └─ Find user, create password reset token (TokenService)
   └─ Send email with token (EmailService.sendPasswordResetEmail)

2. User receives email with token

3. POST /api/v1/auth/reset-password
   └─ Body: { "token": "xxx", "newPassword": "..." }
   └─ AuthService.resetPassword(request)
   └─ TokenService.verifyPasswordResetToken(token)
   └─ Update user password (encoded)
   └─ Mark token as used
   └─ Revoke all refresh tokens for user (TokenService.revokeRefreshToken)
```

---

## 4. Request Flow for Protected Endpoints

```
HTTP Request with Authorization: Bearer <access_token>
   │
   ▼
JwtAuthenticationFilter
   │ Extract token from header
   │ JwtProvider.extractUsername(token)
   │ UserDetailsService.loadUserByUsername(email)
   │ JwtProvider.isTokenValid(token, userDetails)
   │ Set SecurityContextHolder with Authentication
   ▼
Controller (e.g. future /api/v1/me)
   │ Principal available via SecurityContext
   ▼
Response
```

---

## 5. API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/register | No | Register, send verification email |
| POST | /api/v1/auth/authenticate | No | Login (requires verified email) |
| POST | /api/v1/auth/refresh | No | Get new access token |
| GET | /api/v1/auth/verify-email?token= | No | Verify email |
| POST | /api/v1/auth/resend-verification | No | Resend verification email |
| POST | /api/v1/auth/forgot-password | No | Request password reset email |
| POST | /api/v1/auth/reset-password | No | Reset password with token |

---

## 6. Running the Application

1. PostgreSQL running with database `jwt_spring`.
2. Update `application.yml` with your DB credentials and mail settings.
3. `mvn spring-boot:run`.

Tests use H2 in-memory (`src/test/resources/application.yml`).
