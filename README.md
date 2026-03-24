# DroneControlCore (2025)

[English README](./README_EN.md)

![Python](https://img.shields.io/badge/Python-3.10-blue)
![Vue](https://img.shields.io/badge/Vue.js-3.0-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95-teal)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## 项目简介

**DroneControlCore** 是一个面向自主飞行控制的全栈无人机指挥与控制系统。当前项目重点覆盖：

- 实时遥测显示
- 基于 OSM 的地图路径规划
- 任务模式与实时模式混合编排
- 任务历史与回放
- 仿真模式下的完整联调

## 当前核心能力

- **实时遥测可视化**：通过 WebSocket 持续显示无人机位置、航向、高度、俯仰、横滚等状态。
- **任务模式 / 实时模式**：支持任务队列式规划，也支持实时插点，不会破坏已有任务顺序。
- **OSM 路径规划**：点击和悬停都可以走 OpenStreetMap 路网规划，远距离场景支持 corridor 范围规划。
- **任务模式悬停 OSM**：任务模式下，悬停预览的起点固定为“当前序号最后一个任务点”。
- **任务点可编辑**：支持增加、删除、重排任务点，删除后自动重建蓝色规划路线。
- **任务历史与回放**：任务与执行记录持久化到 SQLite，可回放执行轨迹。
- **仿真模式**：无需真实硬件即可完成前后端联调与任务执行验证。
- **OSM 路段缓存**：后端会缓存相同起终点的重复规划结果，降低任务重建时的卡顿。

## 当前规划规则

### 任务模式

- 每次点击都会把新点追加到任务队列尾部。
- 悬停 OSM 预览从当前“最后一个任务点”出发。
- 删除任意任务点后，会按剩余点重新构建路线。
- 刷新页面后，“起点”默认回到当前无人机实时位置。

### 实时模式

- 实时模式新增点不会清空原有任务队列。
- 新增实时点会插到当前队列最前面，成为新的 `任务点 1`。
- 原有任务模式点会整体后移，但相对顺序保持不变。
- 如果在到达原任务点 1 之前再次新增实时点，最新实时点仍然会成为新的 `任务点 1`。

## 开发启动

### 后端

1. 进入项目根目录
2. 激活虚拟环境：

```powershell
venv\Scripts\activate
```

3. 安装依赖：

```powershell
pip install -r requirements.txt
```

4. 启动 FastAPI：

```powershell
venv\Scripts\python -m uvicorn app.main:app --reload --port 8090
```

后端地址：

- [http://127.0.0.1:8090](http://127.0.0.1:8090)
- 文档：[http://127.0.0.1:8090/docs](http://127.0.0.1:8090/docs)

### 前端

1. 进入前端目录：

```powershell
cd frontend
```

2. 安装依赖：

```powershell
npm install
```

3. 启动开发服务：

```powershell
npm run dev
```

前端地址：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

## 测试命令

### 后端导航相关测试

```powershell
venv\Scripts\python -m pytest tests\integration\test_navigation_flow.py tests\integration\test_path_planner.py -q
```

### 前端测试

```powershell
cd frontend
npm test
```

### 前端构建

```powershell
cd frontend
npm run build
```

## Docker 部署

```powershell
docker-compose up --build
```

默认通过 `http://localhost` 访问。

## 项目结构

- **Domain Layer**：核心实体与业务状态定义，例如 `Mission`、`Waypoint`
- **Infrastructure Layer**：MAVSDK、SQLite、OSM 路径规划与缓存
- **API Layer**：FastAPI 路由，提供 mission / execution / navigation / telemetry 接口
- **Frontend**：Vue 3 地图控制台，负责任务队列编辑、模式切换、回放与地图交互
