# User Authentication & Management Activity Diagram

This diagram represents the user authentication and identity management workflow based on `AuthController`, `AuthServiceImpl`, `TokenController`, and `UserService`.

```mermaid
flowchart TD
    Start([Start]) --> ActionChoice{Select Action}

    %% REGISTER FLOW
    ActionChoice -->|Register| Reg1[User submits registration form]
    Reg1 --> RegCheckEmail{Email already in use?}
    RegCheckEmail -->|Yes| RegErr[Return 409 Conflict: Email already pending or in use]
    RegErr --> EndRegErr([End])
    RegCheckEmail -->|No| RegCreate[Create User entity with ROLE_USER & inactive email status]
    RegCreate --> RegOTP[Generate & store 6-digit OTP]
    RegOTP --> RegPublish[Publish OTP Email event]
    RegPublish --> RegResp[Return PENDING_VERIFICATION status]
    RegResp --> EndReg([End])

    %% EMAIL/OTP VERIFICATION FLOW
    ActionChoice -->|Verify OTP / Email| Ver1[User submits OTP or verification token]
    Ver1 --> VerCheck{Valid & unexpired token/OTP?}
    VerCheck -->|No| VerErr[Return error: Invalid / expired token]
    VerErr --> EndVerErr([End])
    VerCheck -->|Yes| VerAlready{Email already verified?}
    VerAlready -->|Yes| VerConflict[Return 400 Bad Request: Email already verified]
    VerConflict --> EndVerAlready([End])
    VerAlready -->|No| VerSuccess[Set emailVerified = true in DB & consume OTP/token]
    VerSuccess --> EndVer([End])

    %% LOGIN FLOW
    ActionChoice -->|Login| Log1[User submits email & password]
    Log1 --> LogAbuse{Abuse protection gate allowed?}
    LogAbuse -->|No| LogLockout[Return 429 Too Many Requests / Blocked]
    LogLockout --> EndLogLockout([End])
    LogAbuse -->|Yes| LogAuth[Spring Security AuthenticationManager authenticates credentials]
    LogAuth --> LogCredCheck{Credentials valid?}
    LogCredCheck -->|No| LogFail[Record failure in abuse tracker & SecurityLogger]
    LogFail --> LogErr[Return 401 Unauthorized: Invalid credentials]
    LogErr --> EndLogErr([End])
    LogCredCheck -->|Yes| LogVerCheck{user.isEmailVerified == true?}
    LogVerCheck -->|No| LogUnverified[Record failure & return 401: Email not verified]
    LogUnverified --> EndLogUnverified([End])
    LogVerCheck -->|Yes| LogSuccessRecord[Record login success in abuse tracker & SecurityLogger]
    LogSuccessRecord --> LogTokenGen[Generate RefreshToken in DB & JWT AccessToken with JTI]
    LogTokenGen --> LogLink[Link AccessToken in Revocation Store]
    LogLink --> LogCookie[Set HTTP-only Cookies for Access & Refresh tokens]
    LogCookie --> LogResp[Return AUTHENTICATED status & token expiration metadata]
    LogResp --> EndLog([End])

    %% REFRESH TOKEN FLOW
    ActionChoice -->|Refresh Token| Ref1[Client sends request with Refresh Token cookie]
    Ref1 --> RefCheck{Token valid, non-expired & non-revoked?}
    RefCheck -->|Reused Revoked Token| RefReuse[Detect token family reuse]
    RefReuse --> RefRevokeFam[Revoke entire Token Family & push forced logout]
    RefRevokeFam --> RefErr1[Return 403 Forbidden]
    RefErr1 --> EndRefErr1([End])
    RefCheck -->|Invalid / Expired| RefErr2[Return 403 Forbidden]
    RefErr2 --> EndRefErr2([End])
    RefCheck -->|Valid| RefRotate[Rotate RefreshToken & issue new AccessToken]
    RefRotate --> RefCookie[Update HTTP-only cookies]
    RefCookie --> RefResp[Return REFRESHED status]
    RefResp --> EndRef([End])

    %% LOGOUT FLOW
    ActionChoice -->|Logout| Out1[Authenticated User submits Logout]
    Out1 --> OutHasToken{Refresh Token provided?}
    OutHasToken -->|Yes| OutSingle[Revoke single session token with LOGOUT reason]
    OutHasToken -->|No| OutAll[Revoke all user active sessions with LOGOUT_ALL reason]
    OutSingle --> OutClear[Clear HTTP-only Auth Cookies & SecurityLogger event]
    OutAll --> OutClear
    OutClear --> EndOut([End])
```
