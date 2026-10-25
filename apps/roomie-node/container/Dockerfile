FROM node:24.18.0-bookworm-slim
RUN npm install --global @openai/codex@0.163.0 @anthropic-ai/claude-code@2.1.310 && npm cache clean --force
COPY launch.mjs /opt/roomie/launch.mjs
USER 65532:65532
ENTRYPOINT ["node", "/opt/roomie/launch.mjs"]
