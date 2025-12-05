#!/bin/bash
echo "docker buildx build --platform linux/amd64 -t eventscape-app:amd64 ."
docker buildx build --platform linux/amd64 -t eventscape-app:amd64 .
echo "docker tag eventscape-app:amd64 sodiumna11/eventscape-app"
docker tag eventscape-app:amd64 sodiumna11/eventscape-app
echo "docker push sodiumna11/eventscape-app"
docker push sodiumna11/eventscape-app
echo "kubectl rollout restart deployment/node-app"
kubectl rollout restart deployment/node-app