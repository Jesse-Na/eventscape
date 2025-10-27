#!/bin/bash
kubectl delete -f dev/app-deployment.yaml
kubectl delete -f dev/app-service.yaml
kubectl delete -f dev/db-deployment.yaml
kubectl delete -f dev/db-service.yaml
kubectl delete -f dev/db-configmap.yaml
minikube stop
minikube delete