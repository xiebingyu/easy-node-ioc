"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
require("reflect-metadata");
const fs_1 = require("fs");
const path_1 = require("path");
const Constants_1 = require("./Constants");
const logger_1 = tslib_1.__importDefault(require("../utils/logger"));
const env = (process.env.NODE_ENV && process.env.NODE_ENV.trim()) || 'prod';
exports.iocContainer = new WeakMap();
exports.controlSet = new Set();
exports.serviceSet = new Set();
exports.preHandles = [];
const startTime = Date.now();
function recurInject(target) {
    if (!target) {
        return;
    }
    const targetInstance = new target();
    logger_1.default.info(`instantiate ${target.name}`);
    const depends = Reflect.getOwnMetadataKeys(target).filter((meta) => 'design:paramtypes' !== meta);
    depends.forEach((depClass) => {
        if (depClass.match(Constants_1.autowired_reg)) {
            const _constructor = Reflect.getMetadata(depClass, target);
            const prop = depClass.replace(Constants_1.autowired_reg, '');
            let depInstance = exports.iocContainer.get(_constructor);
            if (!exports.iocContainer.has(_constructor)) {
                depInstance = recurInject(_constructor);
            }
            targetInstance[prop] = depInstance;
            logger_1.default.info(`add prop [${prop}]: to ${target.name}`);
        }
    });
    exports.iocContainer.set(target, targetInstance);
    return targetInstance;
}
exports.recurInject = recurInject;
function Bootstrap(target) {
    (function run() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('tool start to instantaiate class');
            if (exports.preHandles.length > 0) {
                logger_1.default.info('start to execuate preHandle methods');
                for (const promise of exports.preHandles) {
                    yield promise;
                }
                logger_1.default.info('execuate preHandle methods done');
            }
            const expressInstance = recurInject(target);
            const { app } = expressInstance;
            for (const control of exports.controlSet) {
                const controlInstance = exports.iocContainer.get(control);
                const metas = Reflect.getMetadataKeys(controlInstance);
                const restfulMap = Reflect.getMetadata(Constants_1.RESTFUL, controlInstance);
                const controlPath = Reflect.getMetadata(Constants_1.CONTROL, control);
                Object.getOwnPropertyNames(controlInstance.__proto__)
                    .filter(name => name !== 'constructor')
                    .forEach(methodName => {
                    const method = controlInstance[methodName];
                    const parameterMap = restfulMap.get(method);
                    const methodPath = parameterMap.get('path');
                    const querySet = parameterMap.get('query');
                    const paramsSet = parameterMap.get('params');
                    const bodySet = parameterMap.get('body');
                    const methodType = parameterMap.get('methodType');
                    const args = parameterMap.get('args');
                    const middleWareSet = parameterMap.get(Constants_1.MIDDLEWARE);
                    const handleRequest = (req, res, next) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        const parametersVals = args.map((arg) => {
                            if (paramsSet && paramsSet.has(arg)) {
                                return req.params[arg];
                            }
                            if (querySet && querySet.has(arg)) {
                                return req.query[arg];
                            }
                            if (bodySet && bodySet.has(arg)) {
                                return req.body[arg];
                            }
                        });
                        try {
                            yield method.apply(controlInstance, parametersVals.concat([req, res, next]));
                        }
                        catch (error) {
                            logger_1.default.error(error);
                            res.status(500).send(error && error.message);
                        }
                    });
                    if (middleWareSet) {
                        app[methodType](controlPath + methodPath, Array.from(middleWareSet), handleRequest);
                    }
                    else {
                        app[methodType](controlPath + methodPath, handleRequest);
                    }
                });
            }
            logger_1.default.info('instantaiate all class completely.');
            expressInstance.main();
            logger_1.default.info(`start application spent ${(Date.now() - startTime) / 1000} s`);
        });
    })();
}
exports.Bootstrap = Bootstrap;
function loadFile(path) {
    const stats = fs_1.statSync(path);
    if (stats.isDirectory()) {
        const files = fs_1.readdirSync(path);
        for (const file of files) {
            loadFile(path_1.join(path, file));
        }
    }
    else {
        if (path.match(/.*[^\.]+\b\.(t|j)s\b$/)) {
            logger_1.default.info(`scan file ${path}`);
            require(path);
        }
    }
}
function ComponentScan(scanPath) {
    if (scanPath) {
        scanPath.split(',').forEach(path => {
            loadFile(path);
        });
    }
    return (target) => { };
}
exports.ComponentScan = ComponentScan;
//# sourceMappingURL=Bootstrap.js.map