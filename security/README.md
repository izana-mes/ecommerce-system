# Container Security Checks

## Build images

```bash
docker compose -f docker-compose.yml build
```

## Vulnerability scanning (Trivy)

```bash
./security/trivy-scan.sh
```

The script fails when HIGH/CRITICAL vulnerabilities are found.

## SBOM generation (CycloneDX)

```bash
./security/generate-sbom.sh
```

SBOM files are written to `security/sbom/`.
