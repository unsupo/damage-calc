name=damage_calc
docker ps -a | grep ${name} > /dev/null 2>&1 && { docker stop ${name}; docker rm ${name}; }
docker build -t jarndt/damage-calc .
docker run -p 1000:80 --name ${name} -d jarndt/damage-calc
