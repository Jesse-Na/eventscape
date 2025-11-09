# EventScape

## How to run locally using Docker Compose

-   To start the project
    -   Run `docker compose up --build -d`
-   To stop the project
    -   Run `docker compose down`
        -   Pass the `--volumes` flag if you do not want to preserve the database

## How to run locally using Minikube

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
            -   Copy IP address and paste into browser. e.g. http://127.0.0.1:3000 or http://localhost:3000
            -   Note this ip address will not change, so you only need to do this the first time
-   To restart the project, in your first terminal
    -   `kubectl delete -k overlays/dev`
    -   `minikube stop`
    -   `minikube delete`
    -   Repeat steps above

## How to deploy to DigitalOcean

-   Sign in with `doctl` and switch to the appropriate DigitalOcean context
    -   See the [documentation](https://docs.digitalocean.com/reference/doctl/how-to/install/) for help.
-   Switch kubectl context to Kubernetes cluster on DigitalOcean `doctl kubernetes cluster kubeconfig save 478213db-0a17-41e9-8561-f08fee4fb7ad`
-   Verify you are connected by running `kubectl cluster-info`. You should see the control plane is running on a DigitalOcean domain.
-   Build the docker image `docker buildx build --platform linux/amd64 -t eventscape-app:amd64 .`
-   Tag and push image `docker tag eventscape-app:amd64 sodiumna11/eventscape-app` and `docker push sodiumna11/eventscape-app`
    -   To use your own Docker account, replace `sodiumna11` with your username and update `overlays/prod/app-deployment.yaml` accordingly.
-   Deploy the cluster to DigitalOcean `kubectl apply -k overlays/prod`
-   Wait until all pods are ready `kubectl get pods`
-   Run `kubectl get services` to find out the external IP of the node-app. Copy the IP and paste it into a browser (e.g. http://209.38.2.115).
-   To remove the current deployment, run `kubectl delete -k overlays/prod`

### Deploy digital monitoring agent

-   Follow this [guide](https://docs.digitalocean.com/products/kubernetes/how-to/monitor-advanced/)
