#!/bin/bash
kubectl delete -f base/app-deployment.yaml
kubectl delete -f base/app-service.yaml
kubectl delete -f base/db-deployment.yaml
kubectl delete -f base/db-service.yaml
kubectl delete -f base/db-configmap.yaml
minikube stop
minikube delete