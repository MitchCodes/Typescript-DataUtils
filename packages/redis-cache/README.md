# Typescript-DataUtils

## Disclaimer

These packages are developed for [TypeScript](http://www.typescriptlang.org/) in a Node environment. Some of the below features probably will not be very helpful when working in a purely JavaScript environment.

## About

The purpose of these packages are to provide code helpers to speed up the development time of developing TypeScript code. This is specifically for data-tier operations such as data lookup and caching.

## Installation

You must add the core package regardless of which add-ons you use.

```sh
npm install tsdatautils-core
```

For helper classes for Azure Table Storage, install the below package.

```sh
npm install tsdatautils-azuretablestorage
```

For helper classes for in-memory cache, install the below package.

```sh
npm install tsdatautils-memorycache
```

For helper classes for Redis Cache, install the below package.

```sh
npm install tsdatautils-rediscache
```

## Features

Helper classes for:

* Azure Table Storage
* Redis Cache

## Development Notes

If you intend to contribute to this repository, here are some relevant notes:

### Dependency Order

Since each of the add-on packages depend on the core package, please be sure to update the core first. If anyone has a good suggestion on how to have each package reference each other properly in the development environment without using the actual npm package as a dependency, please feel free to reach out to me.

### Visual Studio Code

This project was created using Visual Studio Code. As for extensions, the jest extension is definitely helpful. The launch.json file was tricky to get working with Jest so below there is an example of the one that is working well for me.

#### _launch.json example:_

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Program",
            "program": "${workspaceFolder}/src\\main.ts",
            "outFiles": [
               "${workspaceFolder}/build/**/*.js"
            ],
            "sourceMaps": true
        },
        {
            "name": "Debug Jest Tests",
            "type": "node",
            "request": "launch",
            "port":9222,
            "cwd": "${workspaceRoot}",
            "runtimeArgs": ["--inspect=9222",
                "${workspaceRoot}/node_modules/jest/bin/jest.js",
                "--config",
                "${workspaceRoot}/jest.config.js",
                "--runInBand",
                "--coverage",
                "false",
                "--no-cache"],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "sourceMaps": true,
            "outFiles": [
                "${workspaceFolder}/build/**/*.js",
                "${workspaceFolder}/__tests__/**/*"
            ],
            "env":{
                "NO_WEBPACK_MIDDLEWARE": "false"
            }
        }
    ]
}
```