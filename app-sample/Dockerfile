FROM public.ecr.aws/docker/library/golang:1.19.2-alpine3.16 as builder

WORKDIR /go/src/consumer
#COPY main.go .
COPY go.mod .
COPY go.sum .

RUN apk add -U git
#RUN go get ./...
RUN go mod download

COPY *.go ./

RUN CGO_ENABLED=0 go build -a -tags netgo -o /consumer 


FROM public.ecr.aws/docker/library/alpine:3.16

RUN apk update \
    && apk add ca-certificates \
    && rm -rf /var/cache/apk/* \
    && update-ca-certificates
    
COPY --from=builder /consumer /
ENTRYPOINT ["/consumer"]