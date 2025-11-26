import os
import sys

def get_files_with_size(start_path):
    """递归获取项目文件大小，并排除标准开发目录。"""
    # 需要排除的目录列表
    EXCLUDE_DIRS = ['venv', 'node_modules', '.git', '__pycache__', '.pytest_cache', 'frontend/node_modules', 'docker/']
    
    file_list = []
    
    for root, dirs, files in os.walk(start_path, topdown=True):
        # 在 os.walk 运行时排除目录，以提高效率
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file_name in files:
            file_path = os.path.join(root, file_name)
            
            # 再次检查排除列表中的文件（如 .DS_Store 等）
            if any(exclude in file_path for exclude in ['.git', '.vscode', '.idea', 'thumbs.db']):
                continue
            
            try:
                if os.path.exists(file_path):
                    size_bytes = os.path.getsize(file_path)
                    file_list.append((file_path, size_bytes))
            except OSError:
                # 忽略权限不足的文件
                continue

    return file_list

def main():
    # 从当前目录开始扫描
    start_path = '.' 
    print("--- 正在扫描项目文件大小 (已排除 venv, node_modules, .git 等) ---")
    
    # 获取文件并按大小降序排序
    files_data = get_files_with_size(start_path)
    files_data.sort(key=lambda item: item[1], reverse=True)
    
    print(f"\n项目总文件数 (不含排除项): {len(files_data)}")
    print("\n--- 最大的 10 个文件 (Largest 10 Files) ---")
    print("-----------------------------------------------------------------------------------------------------")
    print(f"| {'Size (MB)':<10} | {'Size (Bytes)':<15} | {'Path':<50}")
    print("-----------------------------------------------------------------------------------------------------")

    # 打印前 10 个结果
    for path, size in files_data[:10]:
        size_mb = size / (1024 * 1024)
        print(f"| {size_mb:10.2f} | {size:15,} | {path}")
    
    print("-----------------------------------------------------------------------------------------------------")
    print("\n请根据列表检查 yolov8n.pt 和 drone.db 是否出现在其中。")

if __name__ == "__main__":
    main()