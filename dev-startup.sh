#!/bin/bash
minikube start
docker build -t eventscape-app:1.0 .
minikube image load eventscape-app:1.0
kubectl apply -k overlays/dev

echo "Eventscape application deployed to Minikube. Run minikube tunnel to expose the LoadBalancer service."