# EventScape

## How to run locally using Docker Compose

-   To start the project
    -   Create a .env file at the same level as the compose yaml and inside it put your _SENDGRID_API_KEY_.
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
        -   Inside the `base` folder you will also need to create your own `.env.secret` file.
            -   The following keys are required: _SENDGRID_API_KEY_, _SESSION_SECRET_, and _DB_PASSWORD_
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
-   Switch kubectl context to Kubernetes cluster on DigitalOcean `doctl kubernetes cluster kubeconfig save 2de56168-f09f-4af5-8163-ada2a7aa310a`
-   Verify you are connected by running `kubectl cluster-info`. You should see the control plane is running on a DigitalOcean domain.
-   Build the docker image `docker buildx build --platform linux/amd64 -t eventscape-app:amd64 .`
-   Tag and push image `docker tag eventscape-app:amd64 sodiumna11/eventscape-app` and `docker push sodiumna11/eventscape-app`
    -   To use your own Docker account, replace `sodiumna11` with your username and update `overlays/prod/app-deployment.yaml` accordingly.
-   Deploy the cluster to DigitalOcean `kubectl apply -k overlays/prod`
    -   Again, ensure you have `.env.secret` file inside the `base` folder.
-   Wait until all pods are ready `kubectl get pods`
-   Run `kubectl get services` to find out the external IP of the node-app. Copy the IP and paste it into a browser (e.g. http://159.203.54.195).
-   To remove the current deployment, run `kubectl delete -k overlays/prod`

### Rolling updates

-   To apply an update to the Kubernetes deployment, simply deploy the cluster again using `kubectl apply -k overlays/prod`
-   To apply a Docker image (aka an app) update
    -   Start by building the docker image again `docker buildx build --platform linux/amd64 -t eventscape-app:amd64 .`
    -   Then tag and push the image `docker tag eventscape-app:amd64 sodiumna11/eventscape-app` and `docker push sodiumna11/eventscape-app`
    -   Then run `kubectl rollout restart deployment/node-app`
    -   Wait until the new pods are ready `kubectl get pods`

### Deploy digital monitoring agent

-   Follow this [guide](https://docs.digitalocean.com/products/kubernetes/how-to/monitor-advanced/)

### Testing the deployment

-   To test monitoring alerts and the deployment's performance, install k6 and do `k6 run tests/script.js`
    -   Update the file with the correct ip and user credentials
