# User Authentication Sequence Diagram

This sequence diagram details the runtime interactions for User Registration, Login, Token Refresh, Email/OTP Verification, and Logout across `AuthController`, `AuthServiceImpl`, `TokenService`, `JwtProvider`, and Spring Security.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant AC as AuthController
    participant AS as AuthServiceImpl
    participant AP as AuthAbuseProtectionService
    participant AM as AuthenticationManager
    participant UR as UserRepository
    participant TS as TokenService
    participant JP as JwtProvider
    participant AR as AccessTokenRevocationService
    participant OS as OtpService / EmailPublisher
    participant CS as AuthCookieService

    %% REGISTER FLOW
    rect rgb(240, 248, 255)
        note over User, OS: Registration Flow
        User->>AC: POST /api/v1/auth/register (RegisterRequest)
        AC->>AS: register(request)
        AS->>UR: existsByEmailIgnoreCase(email)
        alt Email already exists
            UR-->>AS: true
            AS-->>AC: throw BusinessException(409 Conflict)
            AC-->>User: 409 Conflict: Email already pending or in use
        else Email available
            UR-->>AS: false
            AS->>UR: save(User with ROLE_USER, isEmailVerified=false)
            UR-->>AS: savedUser
            AS->>OS: generateAndStoreOtp(email) & publish(EmailMessage OTP)
            AS-->>AC: AuthenticationResponse(status="PENDING_VERIFICATION")
            AC-->>User: 200 OK (status: PENDING_VERIFICATION)
        end
    end

    %% OTP / EMAIL VERIFICATION
    rect rgb(245, 245, 220)
        note over User, OS: Email / OTP Verification Flow
        User->>AC: POST /api/v1/auth/verify-otp (VerifyOtpRequest)
        AC->>AS: verifyOtp(request)
        AS->>UR: findByEmailIgnoreCase(email)
        UR-->>AS: user
        alt Email already verified
            AS-->>AC: throw BusinessException(400 Bad Request)
            AC-->>User: 400 Bad Request: Email already verified
        else Email not verified
            AS->>OS: validateAndConsumeOtp(email, otp)
            AS->>UR: save(user with emailVerified=true)
            AS-->>AC: void
            AC-->>User: 200 OK (Email verified successfully)
        end
    end

    %% LOGIN FLOW
    rect rgb(230, 255, 230)
        note over User, CS: Authentication / Login Flow
        User->>AC: POST /api/v1/auth/authenticate (LoginRequest)
        AC->>AS: authenticate(request, metadata)
        AS->>AP: assertLoginAllowed(email, ipAddress)
        AS->>AM: authenticate(UsernamePasswordAuthenticationToken)
        alt Bad Credentials
            AM-->>AS: throw BadCredentialsException
            AS->>AP: recordLoginFailure(email, ipAddress)
            AS-->>AC: throw BadCredentialsException
            AC-->>User: 401 Unauthorized
        else Credentials Valid
            AM-->>AS: Authentication
            AS->>UR: findByEmailIgnoreCase(email)
            UR-->>AS: user
            alt Email Not Verified
                AS->>AP: recordLoginFailure(email, ipAddress)
                AS-->>AC: throw UnauthorizedException
                AC-->>User: 401 Unauthorized (Please verify email)
            else Email Verified
                AS->>AP: recordLoginSuccess(email, ipAddress)
                AS->>TS: createRefreshToken(user, metadata)
                TS-->>AS: RefreshIssueResult (tokenEntity, rawToken)
                AS->>JP: generateAccessToken(user, context)
                JP-->>AS: accessToken
                AS->>JP: parseAccessToken(accessToken)
                JP-->>AS: parsed (jti, expiresAt, sessionId, familyId)
                AS->>AR: linkAccessToken(jti, expiresAt, sessionId, familyId, userId, requestId)
                AS-->>AC: AuthenticationResponse(status="AUTHENTICATED", accessToken, refreshToken)
                AC->>CS: writeAuthCookies(request, response, accessToken, refreshToken)
                CS-->>AC: void (Set-Cookie headers set)
                AC-->>User: 200 OK (status: AUTHENTICATED, cookies set)
            end
        end
    end

    %% REFRESH TOKEN FLOW
    rect rgb(255, 240, 245)
        note over User, CS: Refresh Token Flow
        User->>AC: POST /api/v1/auth/refresh (Cookie: refresh_token)
        AC->>CS: readRefreshToken(request)
        CS-->>AC: rawRefreshToken
        AC->>AS: refreshToken(rawRefreshToken, metadata)
        AS->>TS: verifyAndRotateRefreshToken(rawRefreshToken, metadata)
        alt Token Reused / Revoked Family
            TS->>AR: revokeFamilyAccessTokens(familyId)
            TS-->>AS: throw BusinessException(403 Forbidden)
            AS-->>AC: throw 403
            AC-->>User: 403 Forbidden
        else Valid Refresh Token
            TS-->>AS: RefreshIssueResult (rotatedTokenEntity, newRawToken)
            AS->>JP: generateAccessToken(user, context)
            JP-->>AS: newAccessToken
            AS->>AR: linkAccessToken(...)
            AS-->>AC: AuthenticationResponse(status="REFRESHED", newAccessToken, newRawToken)
            AC->>CS: writeAuthCookies(request, response, newAccessToken, newRawToken)
            AC-->>User: 200 OK (status: REFRESHED)
        end
    end

    %% LOGOUT FLOW
    rect rgb(240, 240, 240)
        note over User, CS: Logout Flow
        User->>AC: POST /api/v1/auth/logout
        AC->>CS: readRefreshToken(request)
        CS-->>AC: refreshToken
        AC->>AS: logout(email, refreshToken, metadata)
        alt RefreshToken Present
            AS->>TS: revokeRefreshTokenValue(refreshToken, LOGOUT, metadata)
        else RefreshToken Absent
            AS->>TS: revokeRefreshToken(user, LOGOUT_ALL, metadata)
        end
        AS-->>AC: void
        AC->>CS: clearAuthCookies(request, response)
        AC-->>User: 200 OK (Logged out successfully)
    end
```
