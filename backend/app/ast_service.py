import ast
from app.models import BlastRadiusNode, BlastRadiusEdge


def parse_python_ast(code: str) -> tuple[list[BlastRadiusNode], list[BlastRadiusEdge]]:
    tree = ast.parse(code)
    nodes: list[BlastRadiusNode] = []
    edges: list[BlastRadiusEdge] = []
    functions: dict[str, str] = {}
    classes: dict[str, list[str]] = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            class_id = f"class_{node.name}"
            methods = []
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    methods.append(item.name)
            classes[class_id] = methods
            functions[class_id] = node.name

        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            is_method = False
            for parent in ast.walk(tree):
                if isinstance(parent, ast.ClassDef):
                    for child in parent.body:
                        if child is node:
                            is_method = True
                            break
            if not is_method:
                func_id = f"func_{node.name}"
                functions[func_id] = node.name

    call_graph: dict[str, set[str]] = {fid: set() for fid in functions}

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            caller_id = None
            for fid, fname in functions.items():
                if fname == node.name:
                    caller_id = fid
                    break
            if caller_id is None:
                continue
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    callee_name = None
                    if isinstance(child.func, ast.Name):
                        callee_name = child.func.id
                    elif isinstance(child.func, ast.Attribute):
                        callee_name = child.func.attr
                    if callee_name:
                        for fid, fname in functions.items():
                            if fname == callee_name and fid != caller_id:
                                call_graph[caller_id].add(fid)

    status_cycle = ["healthy", "warning", "critical"]
    icon_map = {
        "class": "🏗️",
        "func": "⚡",
        "async": "🔄",
    }

    x_spacing = 260
    y_spacing = 200
    col_count = max(2, len(functions) // 3 + 1)

    for i, (fid, fname) in enumerate(functions.items()):
        row = i // col_count
        col = i % col_count
        dep_count = len(call_graph.get(fid, set()))
        status = status_cycle[min(dep_count, 2)]

        node_type = "class" if fid.startswith("class_") else "func"
        icon = icon_map.get(node_type, "⚡")

        status_labels = {
            "healthy": "No Issues",
            "warning": f"{dep_count} Dependencies",
            "critical": f"{dep_count} Dependencies",
        }

        nodes.append(BlastRadiusNode(
            id=fid,
            type="serviceNode",
            position={"x": float(col * x_spacing + 20), "y": float(row * y_spacing + 20)},
            data={
                "label": fname,
                "icon": icon,
                "status": status,
                "statusLabel": status_labels[status],
                "metric": f"{dep_count}",
                "metricLabel": "dependencies",
            },
        ))

    edge_colors = {
        "healthy": "#22c55e",
        "warning": "#f59e0b",
        "critical": "#ef4444",
    }

    for caller_id, callees in call_graph.items():
        caller_deps = len(callees)
        color = edge_colors[status_cycle[min(caller_deps, 2)]]
        for callee_id in callees:
            edges.append(BlastRadiusEdge(
                id=f"e_{caller_id}_{callee_id}",
                source=caller_id,
                target=callee_id,
                animated=True,
                style={"stroke": color, "strokeWidth": 2},
            ))

    return nodes, edges


def compute_complexity(code: str) -> list[dict]:
    tree = ast.parse(code)
    results = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            cyclomatic = 1
            cognitive = 0
            nesting_depth = 0

            for child in ast.walk(node):
                if isinstance(child, (ast.If, ast.While, ast.For)):
                    cyclomatic += 1
                    cognitive += 1 + nesting_depth
                elif isinstance(child, ast.BoolOp):
                    cyclomatic += len(child.values) - 1
                    cognitive += 1
                elif isinstance(child, ast.ExceptHandler):
                    cyclomatic += 1
                    cognitive += 1 + nesting_depth
                elif isinstance(child, ast.Assert):
                    cyclomatic += 1

                if isinstance(child, (ast.If, ast.While, ast.For, ast.With, ast.Try)):
                    nesting_depth += 1

            loc = node.end_lineno - node.lineno + 1 if node.end_lineno else 1

            if cyclomatic <= 3:
                big_o = "O(1)"
            elif cyclomatic <= 6:
                big_o = "O(n)"
            elif cyclomatic <= 10:
                big_o = "O(n log n)"
            else:
                big_o = "O(n²)"

            results.append({
                "function_name": node.name,
                "cyclomatic_complexity": cyclomatic,
                "cognitive_complexity": cognitive,
                "estimated_big_o": big_o,
                "lines_of_code": loc,
            })

    return results
