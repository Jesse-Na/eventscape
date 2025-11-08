# EventScape

## How to run locally

-   To start the project
    -   In one terminal
        -   `cd eventscape`
        -   `minikube start`
        -   `docker build -t eventscape-app:1.0 .`
        -   `minikube image load eventscape-app:1.0`
        -   `kubectl apply -k overlays/dev`
        -   `kubectl get pods`
            -   Wait till both pods are 1/1
        -   `minikube tunnel`
    -   In a second terminal
        -   `cd eventscape`
        -   `kubectl get services`
            -   Copy IP address and paste into browser. e.g. http://127.0.0.1:3000
            -   Note this ip address will not change, so you only need to do this the first time
-   To restart the project, in your first terminal
    -   `kubectl delete -k overlays/dev`
    -   `minikube stop`
    -   `minikube delete`
    -   Repeat steps above
