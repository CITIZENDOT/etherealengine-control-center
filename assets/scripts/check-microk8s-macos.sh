#!/bin/bash

set -e

#===========
# Parameters
#===========

PASSWORD=$1
ASSETS_FOLDER=$2

#================
# Verify MicroK8s
#================

CONFIGURE_MICROK8S=false
if echo "$PASSWORD" | sudo -S microk8s version >/dev/null; then
    echo "microk8s is installed"
else
    echo "microk8s is not installed"

    # multipass is needed to package microk8s locally
    brew install --cask multipass

    brew install ubuntu/microk8s/microk8s
    microk8s install --channel=1.26

    echo "Installed multipass and microk8s"

    CONFIGURE_MICROK8S=true

    # Remove previous context from config
    if kubectl config view -o jsonpath='{.contexts}' | grep 'microk8s'; then
        kubectl config delete-context microk8s
    fi

    # Remove previous cluster from config
    if kubectl config view -o jsonpath='{.clusters}' | grep 'microk8s-cluster'; then
        kubectl config delete-cluster microk8s-cluster
    fi

    # Remove previous user from config
    if kubectl config view -o jsonpath='{.users}' | grep 'microk8s-admin'; then
        kubectl config delete-user microk8s-admin
    fi

    # export kubectl config to new config file
    if [[ ! -d ~/.kube ]]; then
        mkdir ~/.kube
    fi
    microk8s config > ~/.kube/config-microk8s

    # add to ~/.bashrc

    # check if .bashrc exists
    if [[ ! -f ~/.bashrc ]]; then
        touch ~/.bashrc
    fi

    # append to .bashrc
    if [[ ! grep -F config-microk8s ~/.bashrc ]]
        echo >> export KUBECONFIG=$KUBECONFIG:
    fi
    # add to export
    export 
fi

kubectl config set-cluster microk8s --server=https://192.168.64.2:16443/
kubectl config set-credentials microk8s-admin --token="$(microk8s kubectl config view --raw -o 'jsonpath={.users[0].user.token}')"
kubectl config set-context microk8s --cluster=microk8s --namespace=default --user=microk8s-admin
kubectl config use-context microk8s

MICROK8S_VERSION=$(microk8s version)
echo "microk8s version is $MICROK8S_VERSION"

MICROK8S_STATUS=$(microk8s status)
echo "microk8s status is $MICROK8S_STATUS"

if microk8s status | grep 'microk8s is not running'; then
    CONFIGURE_MICROK8S=true
fi

if $CONFIGURE_MICROK8S; then
    echo "Microk8s not running, starting..."

    # Start microk8s
    microk8s start

    echo "Microk8s started"

    # Enable Addons
    microk8s enable dashboard
    microk8s enable dns
    microk8s enable registry
    # Since below command can cause terminal to exit.
    set +e
    microk8s enable host-access
    set -e
    microk8s enable ingress
    microk8s enable rbac
    microk8s enable hostpath-storage
    microk8s enable helm3

    echo "Microk8s config enabled"

    # Update kube config with microk8s specific config
    microk8s kubectl config view --raw > ~/.kube/config
    chmod +x ~/.kube/config
    # TODO add $KUBECONFIG to path

    sleep 30

    # Inspect microk8s
    microk8s inspect

    # Check microk8s status
    MICROK8S_STATUS=$(microk8s status)
    echo "microk8s status is $MICROK8S_STATUS"

    if microk8s status | grep 'microk8s is not running'; then
        echo "There is something wrong in your microk8s. Please fix all warnings in 'sudo microk8s inspect' and reboot. If you still face this issue then, try 'sudo snap remove microk8s --purge'"
        exit 4
    fi

    # Update kubernetes dashboard to allow skip login and update user role to have access to metrics.
    # kubectl patch deployment kubernetes-dashboard -n kube-system --type 'json' -p '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--enable-skip-login"}]'
    # kubectl delete clusterrolebinding kubernetes-dashboard -n kube-system
    # kubectl apply -f "$ASSETS_FOLDER/files/microk8s-dashboard.yaml"
fi