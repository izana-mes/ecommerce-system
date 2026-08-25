# Authentication Sequence Diagram

Traced from [`AuthServiceImpl.java`](../../backend/src/main/java/com/example/shop/modules/auth/service/AuthServiceImpl.java), [`WebSocketJwtAuthChannelInterceptor.java`](../../backend/src/main/java/com/example/shop/config/WebSocketJwtAuthChannelInterceptor.java).

## Registration

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF (Next.js)
    participant AC as AuthController
    participant AS as AuthService
    participant UR as UserRepository
    participant RR as RoleRepository
    participant OS as OtpService
    participant EMP as EmailMessagePublisher
    participant MQ as RabbitMQ

    C->>BFF: POST /api/auth/register
    BFF->>AC: POST /api/v1/auth/register
    AC->>AS: register(request)
    AS->>UR: existsByEmailIgnoreCase(email)
    UR-->>AS: false
    AS->>RR: findByName("ROLE_USER")
    RR-->>AS: Role entity
    AS->>UR: save(newUser)
    UR-->>AS: savedUser (emailVerified=false)
    AS->>OS: generateAndStoreOtp(email)
    OS-->>AS: otp code
    AS->>EMP: publish(OTP email message)
    EMP->>MQ: publish to email.general queue
    AS-->>AC: AuthenticationResponse{status: PENDING_VERIFICATION}
    AC-->>BFF: 200 OK
    BFF-->>C: {status: PENDING_VERIFICATION}
```

## OTP Verification

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF
    participant AC as AuthController
    participant AS as AuthService
    participant UR as UserRepository
    participant OS as OtpService

    C->>BFF: POST /api/auth/verify-otp
    BFF->>AC: POST /api/v1/auth/verify-otp
    AC->>AS: verifyOtp(request)
    AS->>UR: findByEmailIgnoreCase(email)
    UR-->>AS: user
    AS->>OS: validateAndConsumeOtp(email, otp)
    OS-->>AS: OK (OTP valid and not expired)
    AS->>UR: save(user with emailVerified=true)
    AS-->>AC: void
    AC-->>BFF: 200 OK
    BFF-->>C: 200 OK
```

## Login

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF
    participant AC as AuthController
    participant AS as AuthService
    participant APS as AuthAbuseProtectionService
    participant AM as AuthenticationManager
    participant UR as UserRepository
    participant TS as TokenService
    participant JP as JwtProvider
    participant ATRS as AccessTokenRevocationService
    participant Redis as Redis
    participant SEL as SecurityEventLogger

    C->>BFF: POST /api/auth/login
    BFF->>AC: POST /api/v1/auth/login {email, password}
    AC->>AS: authenticate(request, metadata)
    AS->>APS: assertLoginAllowed(email, ip)
    APS->>Redis: check rate limit key
    Redis-->>APS: OK
    AS->>AM: authenticate(email, password)
    AM-->>AS: authenticated or BadCredentialsException
    alt Bad credentials
        AS->>APS: recordLoginFailure(email, ip)
        AS->>SEL: warn("login_failure")
        AS-->>AC: throw BadCredentialsException
        AC-->>BFF: 401 Unauthorized
        BFF-->>C: 401 Unauthorized
    else Valid credentials
        AS->>UR: findByEmailIgnoreCase(email)
        UR-->>AS: User entity
        AS->>APS: recordLoginSuccess(email, ip)
        AS->>TS: createRefreshToken(user, metadata)
        TS-->>AS: RefreshIssueResult (entity, rawToken)
        AS->>JP: generateAccessToken(user, context)
        JP-->>AS: signed JWT
        AS->>JP: parseAccessToken(jwt)
        JP-->>AS: AccessTokenParsed {jti, expiresAt, sessionId, familyId}
        AS->>ATRS: linkAccessToken(jti, expiresAt, sessionId, familyId, userId)
        ATRS->>Redis: SET jti → session data, EX ttl
        AS->>SEL: info("login_success")
        AS-->>AC: AuthenticationResponse {accessToken, refreshToken}
        AC-->>BFF: 200 + Set-Cookie: access_token, refresh_token (HttpOnly)
        BFF-->>C: 200 OK (cookies forwarded)
    end
```

## Token Refresh

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF
    participant AC as AuthController
    participant AS as AuthService
    participant TS as TokenService
    participant JP as JwtProvider
    participant ATRS as AccessTokenRevocationService
    participant Redis as Redis

    C->>BFF: POST /api/auth/refresh (cookie: refresh_token)
    BFF->>AC: POST /api/v1/auth/refresh-token
    AC->>AS: refreshToken(refreshTokenStr, metadata)
    AS->>TS: verifyAndRotateRefreshToken(token, metadata)
    TS-->>AS: RefreshIssueResult (new rotated entity, rawToken)
    AS->>JP: generateAccessToken(user, context)
    JP-->>AS: new signed JWT
    AS->>JP: parseAccessToken(jwt)
    AS->>ATRS: linkAccessToken(jti, ...)
    ATRS->>Redis: SET new jti → session data
    AS-->>AC: AuthenticationResponse
    AC-->>BFF: 200 + Set-Cookie: new access_token, new refresh_token
    BFF-->>C: 200 OK
```

## Logout

```mermaid
sequenceDiagram
    participant C as Client
    participant BFF as BFF
    participant AC as AuthController
    participant AS as AuthService
    participant TS as TokenService
    participant SEL as SecurityEventLogger

    C->>BFF: POST /api/auth/logout
    BFF->>AC: POST /api/v1/auth/logout {email, refreshToken?}
    AC->>AS: logout(email, refreshToken, metadata)
    alt refresh token provided
        AS->>TS: revokeRefreshTokenValue(token, LOGOUT, metadata)
        TS-->>AS: OK (single session revoked)
        AS->>SEL: info("logout_success", scope=current_session)
    else no refresh token
        AS->>TS: revokeRefreshToken(user, LOGOUT_ALL, metadata)
        TS-->>AS: OK (all sessions revoked)
        AS->>SEL: info("logout_all_success", scope=all_sessions)
    end
    AS-->>AC: void
    AC-->>BFF: 200 OK + Clear-Cookie
    BFF-->>C: 200 OK
```

## WebSocket STOMP Authentication

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as WebSocket Endpoint
    participant INT as WebSocketJwtAuthChannelInterceptor
    participant JP as JwtProvider
    participant ATRS as AccessTokenRevocationService
    participant Redis as Redis
    participant WSR as WebSocketSessionRegistry

    C->>WS: STOMP CONNECT frame (Authorization: Bearer jwt)
    WS->>INT: preSend(CONNECT message)
    INT->>INT: extract token from native headers or Authorization header
    INT->>JP: parseAccessToken(token)
    JP-->>INT: AccessTokenParsed {jti, email, roles, expiresAt}
    INT->>ATRS: isRevoked(jti)
    ATRS->>Redis: GET jti
    Redis-->>ATRS: exists (not revoked)
    ATRS-->>INT: false (not revoked)
    INT->>INT: set SecurityContext with UserDetails
    INT->>WSR: register(sessionId, email)
    INT-->>WS: allow message through
    WS-->>C: STOMP CONNECTED
```
