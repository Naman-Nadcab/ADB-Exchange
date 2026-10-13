#!/bin/sh
# Classify a production checkout. Does not change the repository.
# Success:
#   PRODUCTION_TREE_STATUS=clean
#   PRODUCTION_TREE_STATUS=clean_except_valid_deploy_marker
# Failure:
#   PRODUCTION_TREE_STATUS=invalid_deploy_marker
#   PRODUCTION_TREE_STATUS=dirty

classify_production_tree() {
  head_sha=$(git rev-parse HEAD)
  porcelain=$(git status --porcelain)

  if [ -z "$porcelain" ]; then
    echo "PRODUCTION_TREE_STATUS=clean"
    return 0
  fi

  if [ "$porcelain" = " M .deploy-rev" ]; then
    if [ -L .deploy-rev ] || [ ! -f .deploy-rev ]; then
      echo "PRODUCTION_TREE_STATUS=invalid_deploy_marker"
      return 1
    fi
    lines=$(wc -l < .deploy-rev | tr -d ' ')
    if [ "$lines" -gt 1 ]; then
      echo "PRODUCTION_TREE_STATUS=invalid_deploy_marker"
      return 1
    fi
    marker=$(head -n 1 .deploy-rev | tr -d '\r')
    if [ "$marker" = "$head_sha" ]; then
      echo "PRODUCTION_TREE_STATUS=clean_except_valid_deploy_marker"
      return 0
    fi
    echo "PRODUCTION_TREE_STATUS=invalid_deploy_marker"
    return 1
  fi

  echo "PRODUCTION_TREE_STATUS=dirty"
  return 1
}

if [ "${FRONTEND_ONLY_TREE_LIBRARY:-}" != 1 ]; then
  classify_production_tree
fi
