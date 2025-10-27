#!/bin/bash
minikube start
docker build -t eventscape-app:1.0 .
minikube image load eventscape-app:1.0
kubectl apply -f db-configmap.yaml
kubectl apply -f db-deployment.yaml
kubectl apply -f db-service.yaml
kubectl apply -f app-deployment.yaml
kubectl apply -f app-service.yaml

echo "Eventscape application deployed to Minikube. Run minikube tunnel to expose the LoadBalancer service."