module.exports = function PercentageConfiguarationSlab(sequelize) {
    var Sequelize = sequelize.constructor;
    var percentageConfig = require('./percentageConfiguaration.model') (sequelize);

    var ret =
      sequelize.define('percentageConfiguarationSlab', {
        start_value: {
          type: Sequelize.INTEGER
        },
        end_value: {
          type: Sequelize.INTEGER
        },
        points: {
          type: Sequelize.INTEGER
        },
        percentage_config_id: {
          type: Sequelize.INTEGER
        },
        status: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
  
      }, {
        tableName: 'percentage_configuaration_slab',
        timestamps: false
  
      });
      ret.belongsTo(percentageConfig, {foreignKey: 'percentage_config_id'});

    return ret;
  }
  