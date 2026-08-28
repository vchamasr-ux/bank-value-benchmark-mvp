import os
import re

component_dirs = {
    'FinancialDashboard': 'dashboards',
    'FinancialDashboardSkeleton': 'dashboards',
    'OperationalDashboard': 'dashboards',
    'GaugeChart': 'charts',
    'Sparkline': 'charts',
    'TrendIndicator': 'charts',
    'TrendSparkline': 'charts',
    'MoversSummaryModal': 'modals',
    'PeerGroupModal': 'modals',
    'SavedBriefsModal': 'modals',
    'SummaryModal': 'modals',
    'MoversView': 'views',
    'PitchbookPresentation': 'views',
    'Slide8_StrategyBrief': 'views',
    'StrategicPlannerTab': 'views',
    'ErrorBoundary': 'core',
    'Tooltip': 'core',
    'USMap': 'core',
    'LandingPage': 'layout',
    'UserProfileMenu': 'layout',
    'BankSearch': 'search',
}

src_dir = os.path.abspath('src')

# Mapping of file's old location to new location
old_to_new = {}
for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            new_path = os.path.join(root, f)
            basename = f.replace('.jsx', '').replace('.js', '')
            
            # Determine old path
            # If it's one of our moved components, its old path was src/components/f
            if basename in component_dirs and root == os.path.join(src_dir, 'components', component_dirs[basename]):
                old_path = os.path.join(src_dir, 'components', f)
            else:
                old_path = new_path
                
            old_to_new[old_path.replace('\\', '/')] = new_path.replace('\\', '/')
            
# Reverse lookups
def find_new_path(old_target_abspath):
    # Try with .jsx and .js if no extension
    for ext in ['', '.jsx', '.js', '/index.js', '/index.jsx']:
        p = old_target_abspath + ext
        if p in old_to_new:
            return old_to_new[p]
    # some generic fallback, just return original assuming it didn't move
    return old_target_abspath

for root, _, files in os.walk(src_dir):
    for f in files:
        if not f.endswith(('.jsx', '.js', '.css')):
            continue
            
        new_path = os.path.join(root, f).replace('\\', '/')
        
        # Deduce old path
        basename = f.replace('.jsx', '').replace('.js', '')
        if basename in component_dirs and root == os.path.join(src_dir, 'components', component_dirs[basename]):
            old_path = os.path.join(src_dir, 'components', f).replace('\\', '/')
        elif basename == 'BankSearch' and root == os.path.join(src_dir, 'components', 'search'):
            old_path = os.path.join(src_dir, 'components', f).replace('\\', '/')
        else:
            old_path = new_path
            
        with open(new_path, 'r', encoding='utf-8') as file:
            content = file.read()
            
        def replace_import(match):
            import_statement = match.group(0)
            rel_import = match.group(1)
            
            # Ignore absolute or node_modules imports
            if not rel_import.startswith('.'):
                return import_statement
                
            # The old target absolute path
            old_dir = os.path.dirname(old_path)
            old_target = os.path.normpath(os.path.join(old_dir, rel_import)).replace('\\', '/')
            
            # Find its new absolute path
            new_target = find_new_path(old_target)
            
            # Compute new relative import
            new_dir = os.path.dirname(new_path)
            new_rel = os.path.relpath(new_target, new_dir).replace('\\', '/')
            
            if not new_rel.startswith('.'):
                new_rel = './' + new_rel
                
            # Keep original extension if it had one, else remove what we added
            if not rel_import.endswith('.jsx') and not rel_import.endswith('.js') and new_rel.endswith('.jsx'):
                new_rel = new_rel[:-4]
            if not rel_import.endswith('.jsx') and not rel_import.endswith('.js') and new_rel.endswith('.js'):
                new_rel = new_rel[:-3]
                
            return import_statement.replace(rel_import, new_rel)

        # Catch `import ... from '...'` and `import('...')`
        new_content = re.sub(r'(?:from\s+|import\s+|^import\s*\()[\'"]([.\/a-zA-Z0-9_-]+)[\'"]', replace_import, content, flags=re.MULTILINE)
        
        if new_content != content:
            with open(new_path, 'w', encoding='utf-8') as file:
                file.write(new_content)
                
