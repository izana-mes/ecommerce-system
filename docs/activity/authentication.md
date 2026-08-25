# Authentication Activity Diagram

Activity flows traced from [`AuthServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/auth/service/AuthServiceImpl.java).

## Registration Flow

```mermaid
flowchart TD
    A([Client: POST /auth/register]) --> B[Normalize email to lowercase]
    B --> C{Email already exists?}
    C -- Yes --> D([Throw 409 CONFLICT])
    C -- No --> E[Create User entity\nisActive=true, emailVerified=false]
    E --> F[Assign ROLE_USER]
    F --> G[Save User to DB]
    G --> H[Generate OTP via OtpService]
    H --> I[Publish OTP email via EmailMessagePublisher\nEmailType.OTP]
    I --> J([Return status: PENDING_VERIFICATION])
```

## OTP Verification Flow

```mermaid
flowchart TD
    A([Client: POST /auth/verify-otp]) --> B[Find user by email]
    B --> C{User found?}
    C -- No --> D([Throw 404 NOT FOUND])
    C -- Yes --> E{Email already verified?}
    E -- Yes --> F([Throw 400 BAD REQUEST])
    E -- No --> G[Validate and consume OTP\nOtpService.validateAndConsumeOtp]
    G --> H{OTP valid?}
    H -- No --> I([Throw error])
    H -- Yes --> J[Set user.emailVerified = true]
    J --> K[Save User]
    K --> L([Return 200 OK])
```

## Login Flow

```mermaid
flowchart TD
    A([Client: POST /auth/login]) --> B[Normalize email]
    B --> C[AuthAbuseProtectionService.assertLoginAllowed\ncheck rate limit by email+IP]
    C --> D{Rate limit exceeded?}
    D -- Yes --> E([Throw 429 TOO MANY REQUESTS])
    D -- No --> F[AuthenticationManager.authenticate\nSpring Security password check]
    F --> G{Bad credentials?}
    G -- Yes --> H[Record login failure in AbuseProtectionService]
    H --> I[Log security event: login_failure]
    I --> J([Throw 401 UNAUTHORIZED])
    G -- No --> K[Load User from DB by email]
    K --> L{Email verified?}
    L -- No --> M[Record login failure]
    M --> N([Throw 401 - email not verified])
    L -- Yes --> O[Record login success]
    O --> P[TokenService.createRefreshToken\ninsert into refresh_tokens table]
    P --> Q[JwtProvider.generateAccessToken\nwith sessionId, familyId, deviceId claims]
    Q --> R[Parse access token to extract JTI]
    R --> S[AccessTokenRevocationService.linkAccessToken\nstore JTI in Redis with TTL]
    S --> T[Log security event: login_success]
    T --> U([Return accessToken + refreshToken\nset as HttpOnly cookies])
```

## Token Refresh Flow

```mermaid
flowchart TD
    A([Client: POST /auth/refresh]) --> B[TokenService.verifyAndRotateRefreshToken]
    B --> C{Refresh token found in DB?}
    C -- No --> D([Throw 401])
    C -- Yes --> E{Token revoked?}
    E -- Yes --> F([Throw 401])
    E -- No --> G{Token expired?}
    G -- Yes --> H([Throw 401])
    G -- No --> I[Rotate: mark old token revoked\nissue new refresh token]
    I --> J[Generate new access token via JwtProvider]
    J --> K[LinkAccessToken: store new JTI in Redis]
    K --> L([Return new accessToken + refreshToken cookies])
```

## Logout Flow

```mermaid
flowchart TD
    A([Client: POST /auth/logout]) --> B{refresh token provided?}
    B -- Yes --> C[TokenService.revokeRefreshTokenValue\nmark single refresh token as revoked in DB]
    C --> D[Log security event: logout_success\nscope=current_session]
    D --> E([Return 200])
    B -- No --> F[TokenService.revokeRefreshToken for user\nmark ALL refresh tokens revoked]
    F --> G[Log security event: logout_all_success\nscope=all_sessions]
    G --> E
```

## Password Reset Flow

```mermaid
flowchart TD
    A([Client: POST /auth/forgot-password]) --> B[Find user by email]
    B --> C[TokenService.createPasswordResetToken\ninsert into password_reset_tokens table]
    C --> D[Publish password reset email\nEmailType.PASSWORD_RESET]
    D --> E([Return 200 - email sent])

    F([Client: POST /auth/reset-password]) --> G[TokenService.verifyPasswordResetToken\ncheck token exists, not used, not expired]
    G --> H{Valid?}
    H -- No --> I([Throw 401])
    H -- Yes --> J[BCrypt encode new password\nsave user]
    J --> K[Mark reset token as used]
    K --> L[TokenService.revokeRefreshToken\nrevoke ALL refresh tokens for user]
    L --> M[AccessTokenRevocationService.revokeUserAccessTokens\nrevoke all JTIs in Redis for user]
    M --> N([Return 200])
```

## Email Verification Link Flow

```mermaid
flowchart TD
    A([Client: GET /auth/verify-email?token=...]) --> B[TokenService.verifyEmailToken\nlookup in email_verification_tokens table]
    B --> C{Token valid, not used, not expired?}
    C -- No --> D([Throw 401])
    C -- Yes --> E{User already verified?}
    E -- Yes --> F([Throw 400])
    E -- No --> G[Set user.emailVerified = true]
    G --> H[Mark token as used]
    H --> I([Return 200])
```

## WebSocket Authentication Flow (STOMP CONNECT)

```mermaid
flowchart TD
    A([Client: STOMP CONNECT]) --> B[WebSocketJwtAuthChannelInterceptor.preSend]
    B --> C{Command = CONNECT?}
    C -- No --> D([Pass through])
    C -- Yes --> E[Extract Authorization header or\nnative header from STOMP frame]
    E --> F{Token present?}
    F -- No --> G([Throw exception: not authenticated])
    F -- Yes --> H[JwtProvider.parseAccessToken\nvalidate signature and expiry]
    H --> I{Valid signature?}
    I -- No --> J([Throw exception: invalid token])
    I -- Yes --> K[AccessTokenRevocationService.isRevoked\ncheck JTI in Redis]
    K --> L{JTI revoked?}
    L -- Yes --> M([Throw exception: token revoked])
    L -- No --> N[Set SecurityContext with user authentication]
    N --> O[Register session in WebSocketSessionRegistry\nsessionId → email mapping]
    O --> P([Allow CONNECT - WebSocket session established])
```
