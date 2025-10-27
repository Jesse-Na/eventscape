#!/bin/bash
minikube start
docker build -t eventscape-app:1.0 .
minikube image load eventscape-app:1.0
kubectl apply -f dev/db-configmap.yaml
kubectl apply -f dev/db-deployment.yaml
kubectl apply -f dev/db-service.yaml
kubectl apply -f dev/app-deployment.yaml
kubectl apply -f dev/app-service.yaml

echo "Eventscape application deployed to Minikube. Run minikube tunnel to expose the LoadBalancer service."