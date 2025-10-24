#!/bin/bash
minikube start
docker build -t eventscape-app:1.0 .
minikube image load eventscape-app:1.0
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

echo "Eventscape application deployed to Minikube. Run minikube tunnel to expose the LoadBalancer service."