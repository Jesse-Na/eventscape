#!/bin/bash
kubectl delete -k overlays/dev
minikube stop
minikube delete