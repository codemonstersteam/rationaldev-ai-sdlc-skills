# Reference image (self-test only) — мультистейдж: сборка ВНУТРИ образа (без хостовой
# кросс-компиляции), запуск в минимальном alpine. Это образец, не показывается агенту.
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /svc .

FROM alpine:3
COPY --from=build /svc /svc
COPY services.yaml /services.yaml
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/svc"]
