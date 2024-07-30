#!/usr/bin/env python3

import os
import sys
import re
import importlib.util
import argparse

md_name_replacements = [(r'^page\d+_', ''), ('\.md$', '')]
path_name_replacements = [('\.py$', '.md')]


def list_markdown_files(directory):
    """List all markdown files in the given directory."""
    files = [f for f in os.listdir(directory) if f.endswith('.md')]
    return files


def list_generated_pages(directory):
    """List all Python modules in the given directory that have a generate function."""
    pages = []
    for f in os.listdir(directory):
        if f.endswith('.py'):
            module_name = f[:-3]
            module_path = os.path.join(directory, f)
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if hasattr(module, 'generate'):
                pages.append(f"{module_name}.md")
                for old, new in md_name_replacements:
                    module_name = re.sub(old, new, module_name)
    return pages

def print_markdown(content, output, raw=False):
    """Print the content as markdown using rich."""
    if output:
        with open(output, 'w') as file:
            file.write(content)
    elif raw:
        print(content)
    else:
        try:
            from rich.console import Console
            from rich.markdown import Markdown
            console = Console()
            markdown = Markdown(content)
            console.print(markdown)
        except:
            sys.stderr.write("Failed to load python.rich - make sure you have the module available. Generated --raw instead.\n")
            print(content)            

def print_markdown_file(file_path, output, raw=False):
    """Print the content of a markdown file using rich."""
    with open(file_path, 'r') as file:
        content = file.read()
    print_markdown(content, output, raw)
    
def main():

    parser = argparse.ArgumentParser(description="Markdown file and generated page viewer.")
    parser.add_argument('filename', nargs='?', help="Part of the filename or generated page to match and display.")
    parser.add_argument('--raw', '-r', action='store_true', help="Output raw markdown without rich formatting.")
    parser.add_argument('--output', '-o', type=str, help="Output to file")
    parser.add_argument('--binary', type=str, help="Name of binary") 
    args = parser.parse_args()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))

    markdown_dir = os.path.normpath(script_dir + '/../src/doc/markdown')
    if not os.path.exists(markdown_dir):
        markdown_dir = '/usr/share/doc/jaiabot/markdown'
    if not os.path.exists(markdown_dir):
        print('Could not find any markdown files - ensure that the jaiabot-doc package is installed (sudo apt install jaiabot-doc)')
        sys.exit(1)
        
    pages_dir = markdown_dir
    
    if not args.filename:
        # No filename provided, list files 
        files = list_markdown_files(markdown_dir)
        generated_pages = list_generated_pages(pages_dir)
        all_files = files + generated_pages
        all_files.sort()
        for old, new in md_name_replacements:
            all_files = [re.sub(old, new, f) for f in all_files]
        if all_files:
            print(f"Available documentation ({markdown_dir}):")
            print(f" [Provide part or all of the file name to display contents]")
            for file in all_files:
                print(f" - {file}")
        else:
            print(f"No markdown files found in {markdown_dir}!")
            sys.exit(1)
    else:

        # Partial filename provided, match and print the markdown content
        part_filename = args.filename
        
        for old, new in path_name_replacements:
            part_filename = re.sub(old, new, part_filename)
            
        files = list_markdown_files(markdown_dir)
        generated_pages = list_generated_pages(pages_dir)
        
        matches = [f for f in files if part_filename in f] + \
                  [f for f in generated_pages if part_filename in f]

        if len(matches) > 1:
            # check if this is unambiguous after applying substitutions
            part_filename_without_extension = re.sub('\.md$', '', part_filename)
            cleaned_matches = matches
            for old, new in md_name_replacements + [('\.md$', '')]:
                cleaned_matches = [re.sub(old, new, f) for f in cleaned_matches]

            try:
                index = cleaned_matches.index(part_filename_without_extension)
                matches=[matches[index]]
            except ValueError:
                pass                
                
        if len(matches) == 1:
            match = matches[0]
            if match in generated_pages:
                module_name = match[:-3]
                module_path = os.path.join(pages_dir, f"{module_name}.py")
                spec = importlib.util.spec_from_file_location(module_name, module_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                content = module.generate()
                print_markdown(content, args.output, args.raw)
            else:
                print_markdown_file(os.path.join(markdown_dir, match), args.output, args.raw)
        elif len(matches) > 1:
            print("Ambiguous match, please specify full string. Multiple files found:")
            for match in matches:
                print(f" - {match}")
            sys.exit(1)
        else:
            print(f"No files found matching '{part_filename}'.")
            sys.exit(1)

if __name__ == "__main__":
    main()
