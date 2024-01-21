# Generating ECDSA Key Pair (e.g., using P-256 curve)
OUT_DIR=.jwt-keys
openssl genpkey -algorithm RSA -out ${OUT_DIR}/rsa-private-key.pem
openssl rsa -pubout -in ${OUT_DIR}/rsa-private-key.pem -out ${OUT_DIR}/rsa-public-key.pem
